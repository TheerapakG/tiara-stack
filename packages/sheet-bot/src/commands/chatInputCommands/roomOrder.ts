import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ApplicationIntegrationType,
  bold,
  inlineCode,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  time,
  TimestampStyles,
} from "discord.js";
import { Array, Effect, Function, HashMap, Option, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { observeOnce } from "typhoon-server/signal";
import { SheetApisClient } from "../../client";
import { roomOrderActionRow } from "../../messageComponents";
import {
  FormatService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  HourRange,
  InteractionContext,
  MessageRoomOrderService,
  PermissionService,
  PlayerService,
  Schedule,
  SheetService,
  Team,
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
        InteractionContext.deferReply.tap(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
        PermissionService.tapCheckEffectRoles(() => ({
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
          teams: SheetService.getTeams(),
          runnerConfig: SheetService.getRunnerConfig(),
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
        Effect.bind("formattedHour", ({ hour }) =>
          FormatService.formatHour(hour),
        ),
        Effect.bind("schedule", ({ hour }) =>
          pipe(
            SheetService.getAllSchedules(),
            Effect.map(HashMap.get(hour)),
            Effect.map(Option.getOrElse(() => Schedule.empty(hour))),
          ),
        ),
        Effect.bind("schedulePlayers", ({ schedule }) =>
          pipe(
            schedule.fills,
            Array.getSomes,
            Effect.forEach(
              (playerName) => PlayerService.getByName(playerName),
              { concurrency: "unbounded" },
            ),
            Effect.map(Array.getSomes),
          ),
        ),
        Effect.bind(
          "scheduleTeams",
          ({ schedulePlayers, teams, runnerConfig, hour }) =>
            pipe(
              schedulePlayers,
              Effect.forEach((player) =>
                pipe(
                  Effect.Do,
                  Effect.let("teams", () =>
                    pipe(
                      HashMap.get(teams, player.id),
                      Option.map(({ teams }) => teams),
                      Option.getOrElse(() => []),
                    ),
                  ),
                  Effect.let("runnerHours", () =>
                    pipe(
                      HashMap.get(runnerConfig, player.name),
                      Option.map(({ hours }) => hours),
                      Option.getOrElse(() => []),
                    ),
                  ),
                  Effect.map(({ teams, runnerHours }) => ({
                    player,
                    teams: pipe(
                      teams,
                      Array.map(
                        (team) =>
                          new Team({
                            ...team,
                            tags: pipe(
                              team.tags,
                              team.tags.includes("tierer_hint") &&
                                Array.some(
                                  runnerHours,
                                  HourRange.includes(hour),
                                )
                                ? Array.append("fixed")
                                : Function.identity,
                            ),
                          }),
                      ),
                    ),
                  })),
                ),
              ),
            ),
        ),
        Effect.bind("roomOrders", ({ heal, scheduleTeams }) =>
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
                          Option.getOrElse(() => 0),
                        );
                        const percent = lead + (backline - lead) / 5;
                        return {
                          type: team.type,
                          tagStr: pipe(team.tags, Array.join(", ")),
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
        Effect.bind("roomOrder", ({ roomOrders }) =>
          pipe(roomOrders, Array.head),
        ),
        InteractionContext.editReply.bind(
          "message",
          ({ hour, formattedHour, roomOrders, roomOrder }) => ({
            content: [
              `${bold(`Hour ${hour}`)} ${time(formattedHour.start, TimestampStyles.ShortDateTime)} - ${time(formattedHour.end, TimestampStyles.ShortDateTime)}`,
              "",
              ...roomOrder.room.map(
                ({ team, tags }, i) =>
                  `${inlineCode(`P${i + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
              ),
            ].join("\n"),
            components: [
              roomOrderActionRow(
                { minRank: 0, maxRank: Array.length(roomOrders) - 1 },
                0,
              ),
            ],
          }),
        ),
        Effect.tap(({ hour, message, roomOrders }) =>
          Effect.all([
            MessageRoomOrderService.upsertMessageRoomOrder(message.id, {
              hour,
              rank: 0,
            }),
            MessageRoomOrderService.upsertMessageRoomOrderData(
              message.id,
              pipe(
                roomOrders,
                Array.map(({ room }, rank) =>
                  room.map(({ team, tags }, position) => ({
                    hour,
                    team,
                    tags,
                    rank,
                    position,
                  })),
                ),
                Array.flatten,
              ),
            ),
          ]),
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
