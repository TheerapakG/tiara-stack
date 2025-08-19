import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, HashMap, Option, pipe, String } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { observeOnce } from "typhoon-server/signal";
import { SheetApisClient } from "../../client";
import {
  emptySchedule,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  PlayerService,
  SheetService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
} from "../../types";
import { bindObject } from "../../utils";

const handleManual = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("manual")
      .setDescription("Manual room order commands")
      .addNumberOption((option) =>
        option.setName("hour").setDescription("The hour to order rooms for"),
      )
      .addNumberOption((option) =>
        option.setName("heal").setDescription("The healer needed"),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server to order rooms for"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.tapDeferReply(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        PermissionService.tapCheckOwner(() => ({ allowSameGuild: true })),
        PermissionService.tapCheckRoles(() => ({
          roles: pipe(
            GuildConfigService.getManagerRoles(),
            Effect.flatMap(observeOnce),
            Effect.map(Array.map((role) => role.roleId)),
          ),
          reason: "You can only order rooms as a manager",
        })),
        bindObject({
          hourOption: InteractionContext.getNumber("hour"),
          heal: pipe(
            InteractionContext.getNumber("heal"),
            Effect.map(Option.getOrElse(() => 0)),
          ),
          user: InteractionContext.user(),
          eventConfig: SheetService.getEventConfig(),
        }),
        Effect.let("hour", ({ hourOption, eventConfig }) =>
          pipe(
            hourOption,
            Option.getOrElse(() =>
              Math.floor(
                (pipe(new Date(), addMinutes(20), getUnixTime) -
                  eventConfig.startTime) /
                  3600 +
                  1,
              ),
            ),
          ),
        ),
        Effect.bind("schedulePlayers", ({ hour }) =>
          pipe(
            SheetService.getAllSchedules(),
            Effect.map(HashMap.get(hour)),
            Effect.map(Option.getOrElse(() => emptySchedule(hour))),
            Effect.map((schedule) => schedule.fills),
            Effect.map(Array.map(Option.fromNullable)),
            Effect.map(Array.getSomes),
            Effect.flatMap(
              Effect.forEach(
                (playerName) => PlayerService.getByName(playerName),
                { concurrency: "unbounded" },
              ),
            ),
            Effect.map(Array.getSomes),
          ),
        ),
        Effect.bind("teams", () => SheetService.getTeams()),
        Effect.let("scheduleTeams", ({ schedulePlayers, teams }) =>
          pipe(
            schedulePlayers,
            Array.map((player) =>
              pipe(
                HashMap.get(teams, player.id),
                Option.map(({ teams }) => ({ player, teams })),
                Option.getOrElse(() => ({ player, teams: [] })),
              ),
            ),
          ),
        ),
        Effect.bind("roomOrder", ({ heal, scheduleTeams }) =>
          pipe(
            SheetApisClient.get(),
            Effect.flatMap((client) =>
              WebSocketClient.once(client, "botCalc", {
                config: {
                  healNeeded: heal,
                  considerEnc: true,
                },
                players: pipe(
                  scheduleTeams,
                  Array.map(({ player, teams }) =>
                    pipe(
                      teams,
                      Array.map((team) => {
                        const lead = pipe(
                          team.lead,
                          Option.getOrElse(() => 0),
                        );
                        const backline = pipe(
                          team.backline,
                          Option.getOrElse(() => 0),
                        );
                        const bp = pipe(
                          team.talent,
                          Option.getOrElse(() => String.empty),
                        );
                        const percent = lead + (backline - lead) / 5;
                        return {
                          type: team.type,
                          tagStr: team.tags.join(", "),
                          player: player.name,
                          team: team.name,
                          lead,
                          backline,
                          bp,
                          percent,
                        };
                      }),
                    ),
                  ),
                ),
              }),
            ),
          ),
        ),
        Effect.asVoid,
        Effect.withSpan("handleRoomOrderManual", { captureStackTrace: true }),
      ),
    ),
  )
  .build();

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandBuilder()
        .setName("room_order")
        .setDescription("Room order commands")
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
    .addSubcommandHandler(handleManual)
    .build();
