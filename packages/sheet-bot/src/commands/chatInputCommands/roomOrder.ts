import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ApplicationIntegrationType,
  bold,
  inlineCode,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, Function, HashMap, Option, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { observeOnce } from "typhoon-server/signal";
import { roomOrderActionRow } from "../../buttons";
import { SheetApisClient } from "../../client";
import {
  emptySchedule,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  MessageRoomOrderService,
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
          teams: SheetService.getTeams(),
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
        Effect.bind("schedule", ({ hour }) =>
          pipe(
            SheetService.getAllSchedules(),
            Effect.map(HashMap.get(hour)),
            Effect.map(Option.getOrElse(() => emptySchedule(hour))),
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
        Effect.bind("message", ({ roomOrders }) =>
          pipe(
            roomOrders,
            Array.head,
            Option.map((roomOrder) =>
              InteractionContext.editReply({
                content: roomOrder.room
                  .map(
                    ({ team, tags }, i) =>
                      `${inlineCode(`P${i + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
                  )
                  .join("\n"),
                components: [
                  roomOrderActionRow(
                    { minRank: 0, maxRank: Array.length(roomOrders) - 1 },
                    0,
                  ),
                ],
              }),
            ),
            Effect.transposeOption,
            // TODO: message on none case
            Effect.flatMap(Function.identity),
          ),
        ),
        Effect.tap(({ hour, message, roomOrders }) =>
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
