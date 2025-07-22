import {
  ApplicationIntegrationType,
  EmbedBuilder,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
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
        userOption: Effect.try(() => interaction.options.getUser("user")),
        serverIdOption: Effect.try(() =>
          interaction.options.getString("server_id"),
        ),
      })),
      Effect.tap(({ serverIdOption }) =>
        serverIdOption !== null && serverIdOption !== interaction.guildId
          ? PermissionService.checkOwner(interaction)
          : Effect.void,
      ),
      Effect.bind("managerRoles", () =>
        interaction.guild
          ? pipe(
              GuildConfigService.getManagerRoles(interaction.guild.id),
              Effect.flatMap((subscription) => observeOnce(subscription.value)),
              Effect.flatMap((observer) => observer.value),
            )
          : Effect.succeed([]),
      ),
      Effect.tap(({ userOption, managerRoles }) =>
        userOption !== null && userOption?.id !== interaction.user.id
          ? PermissionService.checkRoles(
              interaction,
              managerRoles.map((role) => role.roleId),
              "You can only get your own teams in the current server",
            )
          : Effect.void,
      ),
      Effect.bindAll(({ serverIdOption, userOption }) => ({
        user: Effect.succeed(userOption ?? interaction.user),
        serverId: pipe(
          serverIdOption ?? interaction.guildId,
          Option.fromNullable,
        ),
      })),
      Effect.bind("guildConfigsSubscription", ({ serverId }) =>
        GuildConfigService.getConfig(serverId),
      ),
      Effect.bind("guildConfigObserver", ({ guildConfigsSubscription }) =>
        observeOnce(guildConfigsSubscription.value),
      ),
      Effect.bind(
        "guildConfig",
        ({ guildConfigObserver }) => guildConfigObserver.value,
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
