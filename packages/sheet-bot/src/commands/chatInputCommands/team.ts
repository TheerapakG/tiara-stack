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
import { GuildConfigService } from "../../services/guildConfigService";
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
        serverIdOption: Effect.try(() =>
          interaction.options.getString("server_id"),
        ),
        userOption: Effect.try(() => interaction.options.getUser("user")),
      })),
      Effect.tap(({ serverIdOption, userOption }) =>
        interaction.user.id !== interaction.client.application.owner?.id &&
        (serverIdOption !== undefined || userOption !== undefined)
          ? Effect.fail("You can only get your own teams in the current server")
          : Effect.void,
      ),
      Effect.bindAll(({ serverIdOption, userOption }) => ({
        serverId: pipe(
          serverIdOption ?? interaction.guildId,
          Option.fromNullable,
        ),
        user: Effect.succeed(userOption ?? interaction.user),
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
      Effect.bind("sheet", ({ sheetId }) =>
        GoogleSheets.get({
          spreadsheetId: sheetId,
          ranges: ["Teams!C3:C", "Teams!H3:Y"],
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
              .addFields(
                ...userTeams.map((team) => ({
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
