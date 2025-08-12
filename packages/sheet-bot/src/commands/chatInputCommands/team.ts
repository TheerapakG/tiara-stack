import {
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, HashMap, Layer, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  GuildConfigService,
  guildServices,
  PermissionService,
  SheetService,
} from "../../services";
import { RawTeam } from "../../services/guild/sheetService";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
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
  .handler(
    pipe(
      InteractionContext.interaction<ChatInputCommandInteraction>(),
      Effect.flatMap((interaction) =>
        pipe(
          Effect.Do,
          PermissionService.tapCheckOwner({ allowSameGuild: true }),
          Effect.bindAll(() => ({
            user: pipe(
              InteractionContext.getUser("user"),
              Effect.map(Option.getOrElse(() => interaction.user)),
            ),
          })),
          Effect.bind("managerRoles", () =>
            pipe(
              GuildConfigService.getManagerRoles(),
              Effect.flatMap((computed) => observeOnce(computed.value)),
            ),
          ),
          Effect.tap(({ user, managerRoles }) =>
            user.id !== interaction.user.id
              ? PermissionService.checkRoles(
                  managerRoles.map((role) => role.roleId),
                  "You can only get your own teams in the current server",
                )
              : Effect.void,
          ),
          Effect.bind("teams", () => SheetService.getTeams()),
          Effect.let("userTeams", ({ user, teams }) =>
            pipe(
              HashMap.get(teams, user.id),
              Option.map(({ teams }) => teams),
              Option.getOrElse(() => [] as RawTeam[]),
              Array.map((team) => ({
                teamName: team.teamName,
                lead: Option.getOrUndefined(team.lead),
                backline: Option.getOrUndefined(team.backline),
                talent: Option.getOrUndefined(team.talent),
              })),
              Array.map((team) => ({
                ...team,
                leadFormatted: team.lead ?? "?",
                backlineFormatted: team.backline ?? "?",
                talentFormatted: team.talent ? `/${team.talent}k` : "",
                effectValueFormatted:
                  team.lead && team.backline
                    ? ` (+${team.lead + (team.backline - team.lead) / 5}%)`
                    : "",
              })),
            ),
          ),
          Effect.tap(({ user, userTeams }) =>
            InteractionContext.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`${escapeMarkdown(user.username)}'s Teams`)
                  .setDescription(
                    userTeams.length === 0 ? "No teams found" : null,
                  )
                  .addFields(
                    userTeams.map((team) => ({
                      name: escapeMarkdown(team.teamName),
                      value: `ISV: ${team.leadFormatted}/${team.backlineFormatted}${team.talentFormatted}${team.effectValueFormatted}`,
                    })),
                  )
                  .setTimestamp()
                  .setFooter({
                    text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
                  }),
              ],
            }),
          ),
          Effect.provide(
            pipe(
              InteractionContext.getString("server_id"),
              Effect.map(Option.getOrElse(() => interaction.guildId)),
              Effect.flatMap(Option.fromNullable),
              Effect.map(guildServices),
              Layer.unwrapEffect,
            ),
          ),
        ),
      ),
      Effect.withSpan("handleTeamList", { captureStackTrace: true }),
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
