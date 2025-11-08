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
  Match,
  HashMap,
  Option,
  pipe,
  Schema,
} from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { Schema as SheetSchema } from "sheet-apis";
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
                Array.map((s) =>
                  pipe(
                    s.hour,
                    Option.map((hour) => ({ hour, schedule: s })),
                  ),
                ),
              ),
              Effect.map(Array.getSomes),
              Effect.map(ArrayUtils.Collect.toHashMapByKey("hour")),
              Effect.map(HashMap.map(({ schedule }) => schedule)),
            ),
          ),
          Effect.bind("schedule", ({ hour, schedules }) =>
            pipe(
              {
                schedule: HashMap.get(schedules, hour),
              },
              Utils.mapPositional(
                Utils.arraySomesPositional(
                  PlayerService.mapScheduleWithPlayers,
                ),
              ),
            ),
          ),
          Effect.bindAll(({ schedule }) => ({
            fills: pipe(
              schedule.schedule,
              Option.map((schedule) =>
                pipe(
                  Match.value(schedule),
                  Match.tagsExhaustive({
                    BreakSchedule: () => [],
                    ScheduleWithPlayers: (schedule) => schedule.fills,
                  }),
                ),
              ),
              Option.getOrElse(() => []),
              Array.getSomes,
              Effect.succeed,
            ),
            runners: pipe(
              schedule.schedule,
              Option.map((schedule) =>
                pipe(
                  Match.value(schedule),
                  Match.tagsExhaustive({
                    BreakSchedule: () => [],
                    ScheduleWithPlayers: (schedule) => schedule.fills,
                  }),
                ),
              ),
              Option.getOrElse(() => []),
              Array.getSomes,
              Effect.succeed,
            ),
          })),
          Effect.bind("scheduleTeams", ({ fills, runners }) =>
            pipe(
              Effect.Do,
              Effect.let("fillNames", () =>
                pipe(
                  fills,
                  Array.map((player) => player.player.name),
                ),
              ),
              Effect.let("runnerNames", () =>
                pipe(
                  runners,
                  Array.map((player) => player.player.name),
                ),
              ),
              Effect.bind("teams", ({ fillNames }) =>
                PlayerService.getTeamsByName(fillNames),
              ),
              Effect.flatMap(({ runnerNames, teams }) =>
                Effect.forEach(Array.zip(fills, teams), ([fill, teams]) =>
                  pipe(
                    Effect.Do,
                    Effect.map(() => ({
                      teams: pipe(
                        teams,
                        Array.map(
                          (team) =>
                            new SheetSchema.Team({
                              ...team,
                              tags: pipe(
                                team.tags,
                                team.tags.includes("tierer_hint") &&
                                  Array.contains(runnerNames, fill.player.name)
                                  ? Array.append("tierer")
                                  : Function.identity,
                                fill.enc
                                  ? Array.append("encable")
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
          Effect.bind("teams", ({ scheduleTeams }) =>
            pipe(
              scheduleTeams,
              Array.map(({ teams }) =>
                pipe(
                  teams,
                  Array.map((team) => Schema.encode(SheetSchema.Team)(team)),
                  Effect.all,
                ),
              ),
              Effect.all,
            ),
          ),
          Effect.bind("roomOrders", ({ heal, teams }) =>
            pipe(
              SheetApisClient.get(),
              Effect.flatMap((client) =>
                WebSocketClient.once(client, "calc.bot", {
                  config: {
                    healNeeded: heal,
                    considerEnc: true,
                  },
                  players: teams,
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
