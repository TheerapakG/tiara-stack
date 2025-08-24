import {
  ClientService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  SheetService,
} from "@/services";
import { Team } from "@/services/guild/sheetService";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, HashMap, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";

const handleList =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
    .data(
      new SlashCommandSubcommandBuilder()
        .setName("list")
        .setDescription("Get the teams for a user")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to get the teams for"),
        )
        .addStringOption((option) =>
          option
            .setName("server_id")
            .setDescription("The server to get the teams for"),
        ),
    )
    .handler(
      Effect.provide(guildServicesFromInteractionOption("server_id"))(
        pipe(
          Effect.Do,
          InteractionContext.deferReply.tap(),
          PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
          InteractionContext.user.bind("interactionUser"),
          Effect.bindAll(({ interactionUser }) => ({
            managerRoles: pipe(
              GuildConfigService.getManagerRoles(),
              Effect.flatMap(observeOnce),
            ),
            user: pipe(
              InteractionContext.getUser("user"),
              Effect.map(Option.getOrElse(() => interactionUser)),
            ),
          })),
          Effect.tap(({ user, interactionUser, managerRoles }) =>
            pipe(
              PermissionService.checkRoles.sync({
                roles: managerRoles.map((role) => role.roleId),
                reason: "You can only get your own teams in the current server",
              }),
              Effect.unless(() => user.id === interactionUser.id),
            ),
          ),
          Effect.bind("teams", () => SheetService.getTeams()),
          Effect.let("userTeams", ({ user, teams }) =>
            pipe(
              HashMap.get(teams, user.id),
              Option.map(({ teams }) => teams),
              Option.getOrElse(() => [] as Team[]),
              Array.filter((team) => !team.tags.includes("tierer_hint")),
              Array.map((team) => ({
                name: team.name,
                tags: team.tags,
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
          InteractionContext.editReply.tapEffect(({ user, userTeams }) =>
            pipe(
              ClientService.makeEmbedBuilder(),
              Effect.map((embed) => ({
                embeds: [
                  embed
                    .setTitle(`${escapeMarkdown(user.username)}'s Teams`)
                    .setDescription(
                      userTeams.length === 0 ? "No teams found" : null,
                    )
                    .addFields(
                      userTeams.map((team) => ({
                        name: escapeMarkdown(team.name),
                        value: [
                          `Tags: ${
                            team.tags.length === 0
                              ? "None"
                              : escapeMarkdown(team.tags.join(", "))
                          }`,
                          `ISV: ${team.leadFormatted}/${team.backlineFormatted}${team.talentFormatted}${team.effectValueFormatted}`,
                        ].join("\n"),
                      })),
                    ),
                ],
              })),
            ),
          ),
          Effect.withSpan("handleTeamList", { captureStackTrace: true }),
        ),
      ),
    )
    .build();

export const command = chatInputCommandSubcommandHandlerContextBuilder()
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
