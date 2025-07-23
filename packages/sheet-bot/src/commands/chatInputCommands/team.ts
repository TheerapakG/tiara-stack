import {
  ApplicationIntegrationType,
  EmbedBuilder,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, Option, pipe } from "effect";
import { observeEffectSignalOnce } from "typhoon-server/signal";
import { GoogleSheets } from "../../google";
import {
  GuildConfigService,
  PermissionService,
  SheetConfigService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
} from "../../types";

const handleList = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("list")
      .setDescription("Get the teams for a user")
      .addUserOption((option) =>
        option.setName("user").setDescription("The user to get the teams for"),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server to get the teams for"),
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        user: Effect.try(
          () => interaction.options.getUser("user") ?? interaction.user,
        ),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
      })),
      Effect.tap(({ serverId }) =>
        serverId !== interaction.guildId
          ? PermissionService.checkOwner(interaction)
          : Effect.void,
      ),
      Effect.bind("managerRoles", ({ serverId }) =>
        serverId
          ? pipe(
              GuildConfigService.getManagerRoles(serverId),
              observeEffectSignalOnce,
            )
          : Effect.succeed([]),
      ),
      Effect.tap(({ user, managerRoles }) =>
        user.id !== interaction.user.id
          ? PermissionService.checkRoles(
              interaction,
              managerRoles.map((role) => role.roleId),
              "You can only get your own teams in the current server",
            )
          : Effect.void,
      ),
      Effect.bind("guildConfig", ({ serverId }) =>
        observeEffectSignalOnce(GuildConfigService.getConfig(serverId)),
      ),
      Effect.bind("sheetId", ({ guildConfig }) =>
        Option.fromNullable(guildConfig[0].sheetId),
      ),
      Effect.bind("sheetConfig", ({ sheetId }) =>
        SheetConfigService.getRangesConfig(sheetId),
      ),
      Effect.bind("sheet", ({ sheetId, sheetConfig }) =>
        GoogleSheets.get({
          spreadsheetId: sheetId,
          ranges: [sheetConfig.userIds, sheetConfig.userTeams],
        }),
      ),
      Effect.let("teams", ({ sheet }) => {
        const [userIds, userTeams] = sheet.data.valueRanges ?? [];
        return Array.zip(
          userIds.values?.map((value) => value[0]) ?? [],
          userTeams.values ?? [],
        ).flatMap(([userId, userTeams]) =>
          Array.chunksOf(userTeams ?? [], 6).map(
            ([teamName, _isv, lead, backline, talent, _isvPercent]) => ({
              userId,
              teamName,
              lead: Number(lead),
              backline: Number(backline),
              talent,
            }),
          ),
        );
      }),
      Effect.let("userTeams", ({ user, teams }) =>
        teams.filter((team) => team.userId === user.id && team.teamName),
      ),
      Effect.tap(({ user, userTeams }) =>
        interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${escapeMarkdown(user.username)}'s Teams`)
              .setDescription(userTeams.length === 0 ? "No teams found" : null)
              .addFields(
                userTeams.map((team) => ({
                  name: escapeMarkdown(team.teamName),
                  value: `ISV: ${team.lead}/${team.backline}${team.talent ? `/${team.talent}` : ""} (+${team.lead + (team.backline - team.lead) / 5}%)`,
                })),
              )
              .setTimestamp()
              .setFooter({
                text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
              }),
          ],
        }),
      ),
    ),
  )
  .build();

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandBuilder()
        .setName("team")
        .setDescription("Team commands")
        .setIntegrationTypes(
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
          InteractionContextType.BotDM,
          InteractionContextType.Guild,
          InteractionContextType.PrivateChannel,
        ),
    )
    .addSubcommandHandler(handleList)
    .build();
