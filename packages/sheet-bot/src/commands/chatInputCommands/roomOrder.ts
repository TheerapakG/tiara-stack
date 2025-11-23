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
import { waitForGuildManagerRoles } from "@/services/guild/guildConfigSignals";
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
  Cause,
  DateTime,
  Effect,
  Either,
  Function,
  HashSet,
  Match,
  HashMap,
  Option,
  pipe,
  Schema,
} from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { Schema as SheetSchema } from "sheet-apis";
import { Result, RpcResult } from "typhoon-core/schema";
import { Computed, DependencySignal, UntilObserver } from "typhoon-core/signal";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";

type GuildRunningChannelSignal = DependencySignal.DependencySignal<
  RpcResult.RpcResult<
    Result.Result<
      Either.Either<
        SheetSchema.GuildChannelConfig,
        SheetSchema.Error.Core.ArgumentError
      >,
      Either.Either<
        SheetSchema.GuildChannelConfig,
        SheetSchema.Error.Core.ArgumentError
      >
    >,
    unknown
  >,
  never,
  never
>;

const waitForRunningChannel = <E, R>(
  signalEffect: Effect.Effect<
    DependencySignal.DependencySignal<
      RpcResult.RpcResult<unknown, unknown>,
      never,
      never
    >,
    E,
    R
  >,
) =>
  pipe(
    signalEffect,
    Effect.flatMap((signal) =>
      pipe(
        Effect.succeed(signal as GuildRunningChannelSignal),
        Computed.map(
          Result.fromRpcReturningResult<
            Either.Either<
              SheetSchema.GuildChannelConfig,
              SheetSchema.Error.Core.ArgumentError
            >
          >(
            Either.left(
              SheetSchema.Error.Core.makeArgumentError(
                "Loading running channel",
              ),
            ),
          ),
        ),
        UntilObserver.observeUntilScoped(Result.isComplete),
        Effect.flatMap((result) =>
          pipe(
            result.value,
            Either.flatMap(Function.identity),
            Either.match({
              onLeft: (error) => Effect.fail(error),
              onRight: (value) => Effect.succeed(value),
            }),
          ),
        ),
      ),
    ),
  );

const formatEffectValue = (effectValue: number): string => {
  const rounded = Math.round(effectValue * 10) / 10;
  const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  return `+${formatted}%`;
};

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
              waitForGuildManagerRoles(
                GuildConfigService.getGuildManagerRoles(),
              ),
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
                  waitForRunningChannel(
                    GuildConfigService.getGuildRunningChannelByName(
                      channelName,
                    ),
                  ),
                onNone: () =>
                  pipe(
                    InteractionContext.channel(true).sync(),
                    Effect.flatMap((channel) =>
                      waitForRunningChannel(
                        GuildConfigService.getGuildRunningChannelById(
                          channel.id,
                        ),
                      ),
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
                prevSchedule: HashMap.get(schedules, hour - 1),
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
            previousFills: pipe(
              schedule.prevSchedule,
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
            monitor: pipe(
              schedule.schedule,
              Option.map((schedule) =>
                pipe(
                  Match.value(schedule),
                  Match.tagsExhaustive({
                    BreakSchedule: () => Option.none<string>(),
                    ScheduleWithPlayers: (schedule) => schedule.monitor,
                  }),
                ),
              ),
              Option.getOrElse(() => Option.none<string>()),
              Effect.succeed,
            ),
          })),
          Effect.bindAll(({ previousFills, fills, runners }) => ({
            previousFillNames: pipe(
              previousFills,
              Array.map((player) => player.player.name),
              Effect.succeed,
            ),
            fillNames: pipe(
              fills,
              Array.map((player) => player.player.name),
              Effect.succeed,
            ),
            runnerNames: pipe(
              runners,
              Array.map((player) => player.player.name),
              Effect.succeed,
            ),
          })),
          Effect.bind("teams", ({ fills, fillNames, runnerNames }) =>
            pipe(
              PlayerService.getTeamsByName(fillNames),
              Effect.flatMap((teams) =>
                Effect.forEach(Array.zip(fills, teams), ([fill, teams]) =>
                  Effect.forEach(teams, (team) =>
                    pipe(
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
                      Schema.encode(SheetSchema.Team),
                    ),
                  ),
                ),
              ),
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
              Effect.flatMap(
                Array.match({
                  onEmpty: () =>
                    Effect.fail(
                      new Cause.NoSuchElementException(
                        "cannot calculate room orders with given teams",
                      ),
                    ),
                  onNonEmpty: Effect.succeed,
                }),
              ),
            ),
          ),
          InteractionContext.editReply.bind(
            "message",
            ({
              hour,
              previousFillNames,
              fillNames,
              formattedHourWindow: { start, end },
              roomOrders,
              monitor,
            }) => ({
              content: [
                `${bold(`Hour ${hour}`)} ${time(start, TimestampStyles.ShortDateTime)} - ${time(end, TimestampStyles.ShortDateTime)}`,
                ...pipe(
                  monitor,
                  Option.match({
                    onNone: () => [],
                    onSome: (monitor) => [
                      `${inlineCode("Monitor:")} ${monitor}`,
                    ],
                  }),
                ),
                "",
                ...pipe(
                  Array.headNonEmpty(roomOrders).room,
                  Array.map(({ team, tags, effectValue }, i) => {
                    const hasTiererTag = tags.includes("tierer");
                    const effectParts = hasTiererTag
                      ? []
                      : pipe(
                          [
                            Option.some(formatEffectValue(effectValue)),
                            tags.includes("enc")
                              ? Option.some("enc")
                              : Option.none(),
                            tags.includes("doormat")
                              ? Option.some("doormat")
                              : Option.none(),
                          ],
                          Array.getSomes,
                        );
                    const effectStr =
                      effectParts.length > 0
                        ? ` (${Array.join(effectParts, ", ")})`
                        : "";
                    return `${inlineCode(`P${i + 1}:`)}  ${team}${effectStr}`;
                  }),
                ),
                "",
                `${inlineCode("In:")} ${pipe(
                  HashSet.fromIterable(fillNames),
                  HashSet.difference(previousFillNames),
                  HashSet.toValues,
                  Array.join(", "),
                )}`,
                `${inlineCode("Out:")} ${pipe(
                  HashSet.fromIterable(previousFillNames),
                  HashSet.difference(fillNames),
                  HashSet.toValues,
                  Array.join(", "),
                )}`,
              ].join("\n"),
              components: [
                roomOrderActionRow(
                  { minRank: 0, maxRank: Array.length(roomOrders) - 1 },
                  0,
                ),
              ],
            }),
          ),
          Effect.tap(
            ({
              hour,
              previousFillNames,
              fillNames,
              message,
              roomOrders,
              monitor,
            }) =>
              Effect.all([
                MessageRoomOrderService.upsertMessageRoomOrder(message.id, {
                  hour,
                  previousFills: previousFillNames,
                  fills: fillNames,
                  rank: 0,
                  monitor: Option.getOrUndefined(monitor),
                }),
                MessageRoomOrderService.upsertMessageRoomOrderEntry(
                  message.id,
                  hour,
                  pipe(
                    roomOrders,
                    Array.map(({ room }, rank) =>
                      room.map(({ team, tags, effectValue }, position) => ({
                        hour,
                        team,
                        tags: Array.fromIterable(tags),
                        rank,
                        position,
                        effectValue,
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
