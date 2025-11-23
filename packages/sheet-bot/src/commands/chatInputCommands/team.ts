import {
  ClientService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  PlayerService,
} from "@/services";
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
import {
  Array,
  Effect,
  Function,
  Number,
  Option,
  Order,
  flow,
  pipe,
  String,
} from "effect";
import { Schema } from "sheet-apis";
import { Utils } from "typhoon-core/utils";
import { UntilObserver } from "typhoon-core/signal";

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
              GuildConfigService.getGuildManagerRoles(),
              UntilObserver.observeUntilRpcResultResolved(),
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
              Effect.unless(() =>
                String.Equivalence(user.id, interactionUser.id),
              ),
            ),
          ),
          Effect.bind("teams", ({ user }) =>
            pipe(
              {
                user: user.id,
              },
              Utils.mapPositional(
                flow(
                  PlayerService.getTeamsById,
                  UntilObserver.observeUntilRpcResultResolved(),
                ),
              ),
            ),
          ),
          Effect.let("formattedTeams", ({ teams }) =>
            pipe(
              teams.user,
              Array.filter((team) => !team.tags.includes("tierer_hint")),
              Array.sortWith(
                Function.identity,
                Order.combine(
                  Schema.Team.byPlayerName,
                  Order.reverse(Schema.Team.byEffectValue),
                ),
              ),
              Array.map((team) => ({
                teamName: team.teamName,
                tags: team.tags,
                lead: team.lead,
                backline: team.backline,
                talent: team.talent,
                effectValue: Schema.Team.getEffectValue(team),
              })),
              Array.filterMap((team) =>
                pipe(
                  team.teamName,
                  Option.map((teamName) => ({
                    ...team,
                    teamNameFormatted: teamName,
                    leadFormatted: Option.some(`${team.lead}`),
                    backlineFormatted: Option.some(`${team.backline}`),
                    talentFormatted: pipe(
                      team.talent,
                      Option.map((talent) => `${talent}k`),
                    ),
                    effectValueFormatted: `(+${team.effectValue}%)`,
                  })),
                ),
              ),
            ),
          ),
          InteractionContext.editReply.tapEffect(({ user, formattedTeams }) =>
            pipe(
              ClientService.makeEmbedBuilder(),
              Effect.map((embed) => ({
                embeds: [
                  embed
                    .setTitle(`${escapeMarkdown(user.username)}'s Teams`)
                    .setDescription(
                      Number.Equivalence(formattedTeams.length, 0)
                        ? "No teams found"
                        : null,
                    )
                    .addFields(
                      formattedTeams.map((team) => ({
                        name: escapeMarkdown(team.teamNameFormatted),
                        value: [
                          `Tags: ${
                            Number.Equivalence(team.tags.length, 0)
                              ? "None"
                              : escapeMarkdown(team.tags.join(", "))
                          }`,
                          `ISV: ${pipe([team.leadFormatted, team.backlineFormatted, team.talentFormatted], Array.getSomes, Array.join("/"))} ${team.effectValueFormatted}`,
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
