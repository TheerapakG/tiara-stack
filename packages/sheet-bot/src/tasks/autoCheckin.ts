import { checkinButton } from "@/messageComponents";
import {
  channelServicesFromGuildChannelId,
  ConverterService,
  FormatService,
  GuildConfigService,
  PlayerService,
  SendableChannelContext,
  SheetService,
} from "@/services";
import { guildServices } from "@/services/collection/guildServices";
import { BotGuildConfigService, MessageCheckinService } from "@/services/bot";
import {
  ActionRowBuilder,
  ButtonBuilder,
  channelMention,
  MessageActionRowComponentBuilder,
  subtext,
} from "discord.js";
import {
  Array,
  DateTime,
  Effect,
  HashMap,
  flow,
  HashSet,
  Match,
  Option,
  Schedule,
  Cron,
  pipe,
} from "effect";
import { UntilObserver } from "typhoon-core/signal";
import { Schema } from "sheet-apis";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";
import { bindObject } from "@/utils";

const autoCheckinPreviewNotice = "Sent automatically via auto check-in (preview; may have bugs).";

const computeHour = Effect.suspend(() =>
  pipe(
    Effect.Do,
    Effect.bind("now", () => DateTime.now),
    Effect.map(({ now }) => DateTime.addDuration("20 minutes")(now)),
    Effect.flatMap((dt) => ConverterService.convertDateTimeToHour(dt)),
  ),
);

const getCheckinData = ({
  hour,
  runningChannel,
}: {
  hour: number;
  runningChannel: Schema.GuildChannelConfig;
}) =>
  pipe(
    Effect.Do,
    bindObject({
      channelName: runningChannel.name,
    }),
    Effect.bind("schedules", ({ channelName }) =>
      pipe(
        SheetService.channelSchedules(channelName),
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
    Effect.flatMap(({ schedules }) =>
      pipe(
        {
          prevSchedule: HashMap.get(schedules, hour - 1),
          schedule: HashMap.get(schedules, hour),
        },
        Utils.mapPositional(
          Utils.arraySomesPositional(
            flow(
              PlayerService.mapScheduleWithPlayers,
              UntilObserver.observeUntilRpcResultResolved(),
              Effect.flatten,
            ),
          ),
        ),
      ),
    ),
    Effect.map(({ prevSchedule, schedule }) => ({
      prevSchedule,
      schedule,
      runningChannel,
      showChannelMention: Option.isNone(runningChannel.roleId),
    })),
  );

const getCheckinMessages = (
  data: {
    prevSchedule: Option.Option<Schema.ScheduleWithPlayers | Schema.BreakSchedule>;
    schedule: Option.Option<Schema.ScheduleWithPlayers | Schema.BreakSchedule>;
    runningChannel: {
      channelId: string;
      name: Option.Option<string>;
    };
    showChannelMention: boolean;
  },
  template: Option.Option<string>,
) =>
  FormatService.formatCheckIn({
    prevSchedule: data.prevSchedule,
    schedule: data.schedule,
    channelString: data.showChannelMention
      ? `head to ${channelMention(data.runningChannel.channelId)}`
      : pipe(
          data.runningChannel.name,
          Option.map((name) => `head to ${name}`),
          Option.getOrElse(
            () => "await further instructions from the manager on where the running channel is",
          ),
        ),
    template: pipe(template, Option.getOrUndefined),
  });

const runOnce = Effect.suspend(() =>
  pipe(
    Effect.Do,
    Effect.tap(() => Effect.log(`running auto check-in task...`)),
    Effect.bind("guilds", () =>
      pipe(
        BotGuildConfigService.getAutoCheckinGuilds(),
        UntilObserver.observeUntilRpcResultResolved(),
        Effect.flatten,
      ),
    ),
    Effect.bind("guildCounts", ({ guilds }) =>
      Effect.forEach(guilds, (guild) =>
        Effect.provide(guildServices(guild.guildId))(
          pipe(
            Effect.Do,
            Effect.tap(() => Effect.log(`running auto check-in task for guild ${guild.guildId}`)),
            Effect.bind("hour", () => computeHour),
            Effect.bind("allSchedules", () => SheetService.allSchedules()),
            Effect.let("channels", ({ allSchedules }) =>
              pipe(
                allSchedules,
                Array.map((s) => s.channel),
                (names) => HashSet.fromIterable(names),
                HashSet.toValues,
              ),
            ),
            Effect.flatMap(({ hour, channels }) =>
              pipe(
                Effect.forEach(
                  channels,
                  (channelName) =>
                    pipe(
                      GuildConfigService.getGuildRunningChannelByName(channelName),
                      UntilObserver.observeUntilRpcResultResolved(),
                      Effect.flatten,
                      Effect.tap((runningChannel) => Effect.log(runningChannel)),
                      Effect.flatMap((runningChannel) =>
                        pipe(
                          Effect.Do,
                          Effect.let("checkinChannelId", () =>
                            pipe(
                              runningChannel.checkinChannelId,
                              Option.getOrElse(() => runningChannel.channelId),
                            ),
                          ),
                          Effect.bind("checkinData", () =>
                            pipe(
                              getCheckinData({ hour, runningChannel }),
                              Effect.tap((checkinData) => Effect.log(checkinData)),
                            ),
                          ),
                          Effect.let("fillIds", ({ checkinData }) =>
                            pipe(
                              checkinData.schedule,
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
                              Array.map((player) =>
                                pipe(
                                  Match.value(player.player),
                                  Match.tagsExhaustive({
                                    Player: (player) => Option.some(player.id),
                                    PartialNamePlayer: () => Option.none(),
                                  }),
                                ),
                              ),
                              Array.getSomes,
                              HashSet.fromIterable,
                              HashSet.toValues,
                            ),
                          ),
                          Effect.bind("checkinMessages", ({ checkinData }) =>
                            pipe(
                              getCheckinMessages(checkinData, Option.none()),
                              Effect.tap((checkinMessages) => Effect.log(checkinMessages)),
                            ),
                          ),
                          Effect.bind("message", ({ checkinMessages, checkinChannelId }) =>
                            pipe(
                              checkinMessages.checkinMessage,
                              Effect.transposeMapOption((checkinMessage) =>
                                pipe(
                                  Effect.Do,
                                  Effect.let("initialMessage", () =>
                                    [checkinMessage, subtext(autoCheckinPreviewNotice)].join("\n"),
                                  ),
                                  SendableChannelContext.send().bind(
                                    "message",
                                    ({ initialMessage }) => ({
                                      content: initialMessage,
                                      components: [
                                        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                                          new ButtonBuilder(checkinButton.data),
                                        ),
                                      ],
                                    }),
                                  ),
                                ),
                              ),
                              Effect.provide(channelServicesFromGuildChannelId(checkinChannelId)),
                            ),
                          ),
                          Effect.tap(({ checkinData, message, fillIds }) =>
                            pipe(
                              message,
                              Effect.transposeMapOption(({ initialMessage, message }) =>
                                Effect.all(
                                  [
                                    MessageCheckinService.upsertMessageCheckinData(message.id, {
                                      initialMessage,
                                      hour,
                                      channelId: checkinData.runningChannel.channelId,
                                      roleId: Option.getOrNull(checkinData.runningChannel.roleId),
                                    }),
                                    pipe(
                                      MessageCheckinService.addMessageCheckinMembers(
                                        message.id,
                                        fillIds,
                                      ),
                                      Effect.unless(() => Array.isEmptyArray(fillIds)),
                                    ),
                                  ],
                                  { concurrency: "unbounded" },
                                ),
                              ),
                            ),
                          ),
                          Effect.map(({ message }) => (Option.isSome(message) ? 1 : 0)),
                        ),
                      ),
                      Effect.catchAll((error) => pipe(Effect.logError(error), Effect.as(0))),
                    ),
                  { concurrency: "unbounded" },
                ),
                Effect.map((counts) => counts.reduce((acc: number, n: number) => acc + n, 0)),
                Effect.tap((sent) =>
                  Effect.log(`sent ${sent} check-in message(s) for guild ${guild.guildId}`),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    Effect.let("total", ({ guildCounts }) =>
      guildCounts.reduce((acc: number, n: number) => acc + n, 0),
    ),
    Effect.tap(({ total, guildCounts }) =>
      Effect.log(`sent ${total} check-in message(s) across all ${guildCounts.length} guilds`),
    ),
    Effect.withSpan("autoCheckin.runOnce", { captureStackTrace: true }),
  ),
);

export const autoCheckinTask = pipe(
  runOnce,
  Effect.schedule(
    Schedule.cron(
      Cron.make({
        seconds: [0],
        minutes: [45],
        hours: [],
        days: [],
        months: [],
        weekdays: [],
      }),
    ),
  ),
  Effect.withSpan("autoCheckinTask", {
    attributes: { task: "autoCheckin" },
    captureStackTrace: true,
  }),
  Effect.annotateLogs({ task: "autoCheckin" }),
);
