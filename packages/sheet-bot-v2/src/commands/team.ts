import { escapeMarkdown } from "@discordjs/formatters";
import { Ix } from "dfx";
import { InteractionsRegistry } from "dfx/gateway";
import { ApplicationIntegrationType, InteractionContextType } from "discord-api-types/v10";
import { Array, Effect, Function, Layer, Number, Option, Order, pipe } from "effect";
import { DiscordGatewayLayer } from "../discord/gateway";
import { CommandHelper, Interaction } from "../utils";
import { EmbedService, GuildConfigService, PermissionService, PlayerService } from "../services";
import { Sheet } from "sheet-apis/schema";

const makeListSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const playerService = yield* PlayerService;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("list")
        .setDescription("Get the teams for a user")
        .addUserOption((option) =>
          option.setName("user").setDescription("The user to get the teams for"),
        )
        .addStringOption((option) =>
          option.setName("server_id").setDescription("The server to get the teams for"),
        ),
    Effect.fn("team.list")(function* (command) {
      yield* command.deferReply();
      const interactionGuildId = (yield* Interaction.guild()).pipe(Option.map((guild) => guild.id));
      const serverId = command.optionValueOptional("server_id");
      const guildId = pipe(
        serverId,
        Option.orElse(() => interactionGuildId),
        Option.getOrThrow,
      );
      const managerRoles = yield* guildConfigService.getGuildManagerRoles(guildId);

      yield* Effect.firstSuccessOf([
        permissionService.checkInteractionUserApplicationOwner(),
        permissionService.checkInteractionInGuild(Option.getOrUndefined(serverId)),
      ]);

      const interactionUser = yield* Interaction.user();
      const targetUser = command.optionUserValueOptional("user").pipe(
        Option.map((user) => ("user" in user ? user.user : user)),
        Option.getOrElse(() => interactionUser),
      );

      if (interactionUser.id !== targetUser.id) {
        const canView = yield* pipe(
          permissionService.checkInteractionUserGuildRoles(
            managerRoles.map((role) => role.roleId),
            guildId,
          ),
          Effect.catchTag("PermissionError", () => Effect.succeed(false)),
        );

        if (!canView) {
          yield* command.editReply({
            payload: {
              content: "You can only get your own teams in the current server",
            },
          });
          return;
        }
      }

      const teams = yield* playerService.getTeamsById(guildId, [targetUser.id]);

      const formattedTeams = pipe(
        teams,
        Array.flatten,
        Array.filter((team) => !team.tags.includes("tierer_hint")),
        Array.sortWith(
          Function.identity,
          Order.combine(Sheet.Team.byPlayerName, Order.reverse(Sheet.Team.byEffectValue)),
        ),
        Array.map((team) => ({
          teamName: team.teamName,
          tags: team.tags,
          lead: team.lead,
          backline: team.backline,
          talent: team.talent,
          effectValue: Sheet.Team.getEffectValue(team),
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
      );

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`${escapeMarkdown(targetUser.username)}'s Teams`)
              .setDescription(
                Number.Equivalence(formattedTeams.length, 0) ? "No teams found" : null,
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
                    `ISV: ${pipe(
                      [team.leadFormatted, team.backlineFormatted, team.talentFormatted],
                      Array.getSomes,
                      Array.join("/"),
                    )} ${team.effectValueFormatted}`,
                  ].join("\n"),
                })),
              )
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeTeamCommand = Effect.gen(function* () {
  const listSubCommand = yield* makeListSubCommand;

  return yield* CommandHelper.makeCommand(
    (builder) =>
      builder
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
        )
        .addSubcommand(() => listSubCommand.data),
    (command) =>
      command.subCommands({
        list: listSubCommand.handler,
      }),
  );
});

const makeGlobalTeamCommand = Effect.gen(function* () {
  const teamCommand = yield* makeTeamCommand;

  return CommandHelper.makeGlobalCommand(teamCommand.data, teamCommand.handler);
});

export const TeamCommandLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const command = yield* makeGlobalTeamCommand;

    yield* registry.register(Ix.builder.add(command).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DiscordGatewayLayer,
      PermissionService.Default,
      GuildConfigService.Default,
      PlayerService.Default,
      EmbedService.Default,
    ),
  ),
);
