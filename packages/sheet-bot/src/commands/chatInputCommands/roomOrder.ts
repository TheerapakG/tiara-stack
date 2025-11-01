import { SheetApisClient } from "@/client";
import { roomOrderActionRow } from "@/messageComponents";
import {
  ConverterService,
  FormatService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  MessageRoomOrderService,
  PermissionService,
  PlayerService,
  SheetService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
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
import {
  Array,
  DateTime,
  Effect,
  Function,
  HashMap,
  Option,
  pipe,
} from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { Schema } from "sheet-apis";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";

const handleManual =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
    .data(
      new SlashCommandSubcommandBuilder()
        .setName("manual")
        .setDescription("Manual room order commands")
        .addStringOption((option) =>
          option
            .setName("channel_name")
            .setDescription("The name of the running channel"),
        )
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
          PermissionService.checkRoles.tapEffect(() =>
            pipe(
              GuildConfigService.getGuildManagerRoles(),
              Effect.map(Array.map((role) => role.roleId)),
              Effect.map((roles) => ({
                roles,
                reason: "You can only order rooms as a manager",
              })),
            ),
          ),
          InteractionContext.user.bind("user"),
          bindObject({
            hourOption: InteractionContext.getNumber("hour"),
            channelNameOption: InteractionContext.getString("channel_name"),
            heal: pipe(
              InteractionContext.getNumber("heal"),
              Effect.map(Option.getOrElse(() => 0)),
            ),
            runnerConfig: SheetService.runnerConfig,
          }),
          Effect.bind("hour", ({ hourOption }) =>
            pipe(
              hourOption,
              Option.match({
                onSome: Effect.succeed,
                onNone: () =>
                  pipe(
                    DateTime.now,
                    Effect.map(DateTime.addDuration("20 minutes")),
                    Effect.flatMap(ConverterService.convertDateTimeToHour),
                  ),
              }),
            ),
          ),
          Effect.bind("runningChannel", ({ channelNameOption }) =>
            pipe(
              channelNameOption,
              Option.match({
                onSome: (channelName) =>
                  GuildConfigService.getGuildRunningChannelByName(channelName),
                onNone: () =>
                  pipe(
                    InteractionContext.channel(true).sync(),
                    Effect.flatMap((channel) =>
                      GuildConfigService.getGuildRunningChannelById(channel.id),
                    ),
                  ),
              }),
            ),
          ),
          Effect.let("runnerConfigMap", ({ runnerConfig }) =>
            pipe(runnerConfig, ArrayUtils.Collect.toHashMapByKey("name")),
          ),
          Effect.bind("formattedHourWindow", ({ hour }) =>
            pipe(
              ConverterService.convertHourToHourWindow(hour),
              Effect.flatMap(FormatService.formatHourWindow),
            ),
          ),
          Effect.bind("schedules", ({ runningChannel }) =>
            pipe(
              runningChannel.name,
              Effect.flatMap(SheetService.channelSchedules),
              Effect.map(
                HashMap.reduce(
                  HashMap.empty<number, Schema.Schedule>(),
                  (acc, a) => HashMap.union(acc, a),
                ),
              ),
            ),
          ),
          Effect.bind("schedule", ({ hour, schedules }) =>
            pipe(
              {
                schedule: pipe(
                  HashMap.get(schedules, hour),
                  Option.getOrElse(() => Schema.Schedule.makeEmpty(hour)),
                ),
              },
              Utils.mapPositional(PlayerService.mapScheduleWithPlayers),
            ),
          ),
          Effect.bind("scheduleTeams", ({ schedule, runnerConfigMap, hour }) =>
            pipe(
              Effect.Do,
              Effect.let("players", () =>
                pipe(schedule.schedule.fills, Array.getSomes),
              ),
              Effect.bind("teams", ({ players }) =>
                pipe(
                  players,
                  Array.map((player) => player.name),
                  PlayerService.getTeamsByName,
                ),
              ),
              Effect.map(({ players, teams }) => Array.zip(players, teams)),
              Effect.flatMap(
                Effect.forEach(([player, teams]) =>
                  pipe(
                    Effect.Do,
                    Effect.let("runnerHours", () =>
                      pipe(
                        HashMap.get(runnerConfigMap, Option.some(player.name)),
                        Option.map(({ hours }) => hours),
                        Option.getOrElse(() => []),
                      ),
                    ),
                    Effect.map(({ runnerHours }) => ({
                      player,
                      teams: pipe(
                        teams,
                        Array.map(
                          (team) =>
                            new Schema.Team({
                              ...team,
                              tags: pipe(
                                team.tags,
                                team.tags.includes("tierer_hint") &&
                                  Array.some(
                                    runnerHours,
                                    Schema.HourRange.includes(hour),
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
          ),
          Effect.bind("roomOrders", ({ heal, scheduleTeams }) =>
            pipe(
              SheetApisClient.get(),
              Effect.flatMap((client) =>
                WebSocketClient.once(client, "calc.bot", {
                  config: {
                    healNeeded: heal,
                    considerEnc: true,
                  },
                  players: pipe(
                    scheduleTeams,
                    Array.map(({ teams }) => teams),
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
            ({
              hour,
              formattedHourWindow: { start, end },
              roomOrders,
              roomOrder,
            }) => ({
              content: [
                `${bold(`Hour ${hour}`)} ${time(start, TimestampStyles.ShortDateTime)} - ${time(end, TimestampStyles.ShortDateTime)}`,
                "",
                ...roomOrder.room.map(
                  ({ team, tags }, i) =>
                    `${inlineCode(`P${i + 1}:`)}  ${team}${tags.includes("enc") ? " (enc)" : tags.includes("doormat") ? " (doormat)" : ""}`,
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
              MessageRoomOrderService.upsertMessageRoomOrderEntry(
                message.id,
                hour,
                pipe(
                  roomOrders,
                  Array.map(({ room }, rank) =>
                    room.map(({ team, tags }, position) => ({
                      hour,
                      team,
                      tags: Array.fromIterable(tags),
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

export const command = chatInputCommandSubcommandHandlerContextBuilder()
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
