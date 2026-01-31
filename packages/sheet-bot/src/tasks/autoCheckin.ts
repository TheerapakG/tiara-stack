import { checkinButton } from "@/messageComponents";
import {
  channelServicesFromGuildChannelId,
  ConverterService,
  FormatService,
  GuildConfigService,
  ClientService,
  SendableChannelContext,
  SheetService,
  ScheduleService,
} from "@/services";
import { guildServices } from "@/services/collection/guildServices";
import { BotGuildConfigService, MessageCheckinService } from "@/services/bot";
import {
  ActionRowBuilder,
  ButtonBuilder,
  channelMention,
  MessageActionRowComponentBuilder,
  subtext,
  userMention,
} from "discord.js";
import {
  Array,
  DateTime,
  Effect,
  HashMap,
  HashSet,
  Match,
  Option,
  Schedule,
  Cron,
  pipe,
} from "effect";
import { GuildConfig, Sheet } from "sheet-apis/schema";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { bindObject } from "@/utils";

const autoCheckinPreviewNotice = "Sent automatically via auto check-in (preview; may have bugs).";

const noMonitor = {
  mention: Option.none<string>(),
  mentionUserId: Option.none<string>(),
  failure: Option.none<string>(),
};

const monitorNotAssigned = {
  mention: Option.none<string>(),
  mentionUserId: Option.none<string>(),
  failure: Option.some("Cannot ping monitor: monitor not assigned for this hour."),
};

const resolveMonitorFromName = (monitor: Sheet.PopulatedScheduleMonitor) =>
  pipe(
    Match.value(monitor.monitor),
    Match.tagsExhaustive({
      Monitor: (monitor) => Option.some(monitor),
      PartialNameMonitor: () => Option.none(),
    }),
    Option.map((monitor) => monitor.id),
    Option.match({
      onSome: (id) => ({
        mention: Option.some(userMention(id)),
        mentionUserId: Option.some(id),
        failure: Option.none<string>(),
      }),
      onNone: () => ({
        mention: Option.none<string>(),
        mentionUserId: Option.none<string>(),
        failure: Option.some(
          `Cannot ping monitor: monitor "${monitor.monitor.name}" is missing a Discord ID in the sheet.`,
        ),
      }),
    }),
  );

const resolveMonitorMention = (
  schedule: Option.Option<Sheet.PopulatedSchedule | Sheet.PopulatedBreakSchedule>,
) =>
  pipe(
    schedule,
    Option.match({
      onNone: () => noMonitor,
      onSome: (schedule) =>
        pipe(
          Match.value(schedule),
          Match.tagsExhaustive({
            PopulatedBreakSchedule: () => noMonitor,
            PopulatedSchedule: (schedule) =>
              pipe(
                schedule.monitor,
                Option.match({
                  onNone: () => monitorNotAssigned,
                  onSome: (monitor) => resolveMonitorFromName(monitor),
                }),
              ),
          }),
        ),
    }),
  );

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
  runningChannel: GuildConfig.GuildChannelConfig;
}) =>
  pipe(
    Effect.Do,
    bindObject({
      channelName: runningChannel.name,
    }),
    Effect.bind("schedules", ({ channelName }) =>
      pipe(
        ScheduleService.channelPopulatedSchedules(channelName),
        Effect.map(
          Array.filterMap((schedule) =>
            pipe(
              schedule.hour,
              Option.map((hour) => ({ hour, schedule })),
            ),
          ),
        ),
        Effect.map(ArrayUtils.Collect.toHashMapByKey("hour")),
        Effect.map(HashMap.map(({ schedule }) => schedule)),
      ),
    ),
    Effect.map(({ schedules }) => ({
      prevSchedule: HashMap.get(schedules, hour - 1),
      schedule: HashMap.get(schedules, hour),
    })),
    Effect.map(({ prevSchedule, schedule }) => ({
      prevSchedule,
      schedule,
      runningChannel,
      showChannelMention: Option.isNone(runningChannel.roleId),
    })),
  );

const getCheckinMessages = (
  data: {
    prevSchedule: Option.Option<Sheet.PopulatedSchedule | Sheet.PopulatedBreakSchedule>;
    schedule: Option.Option<Sheet.PopulatedSchedule | Sheet.PopulatedBreakSchedule>;
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
            () => "await further instructions from the monitor on where the running channel is",
          ),
        ),
    template: pipe(template, Option.getOrUndefined),
  });

const runOnce = Effect.suspend(() =>
  pipe(
    Effect.Do,
    Effect.tap(() => Effect.log(`running auto check-in task...`)),
    Effect.bind("guilds", () => BotGuildConfigService.getAutoCheckinGuilds()),
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
                          Effect.let("monitorInfo", ({ checkinData }) =>
                            resolveMonitorMention(checkinData.schedule),
                          ),
                          Effect.let("fillIds", ({ checkinData }) =>
                            pipe(
                              checkinData.schedule,
                              Option.map((schedule) =>
                                pipe(
                                  Match.value(schedule),
                                  Match.tagsExhaustive({
                                    PopulatedBreakSchedule: () => [],
                                    PopulatedSchedule: (schedule) => schedule.fills,
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
                          Effect.tap(({ checkinMessages, checkinData, monitorInfo }) =>
                            pipe(
                              ClientService.makeEmbedBuilder(),
                              Effect.map((embed) =>
                                embed.setTitle("Auto check-in summary for monitors").setDescription(
                                  [
                                    checkinMessages.managerCheckinMessage,
                                    ...pipe(
                                      monitorInfo.failure,
                                      Option.match({
                                        onSome: (failure) => [subtext(failure)],
                                        onNone: () => [],
                                      }),
                                    ),
                                    subtext(autoCheckinPreviewNotice),
                                  ].join("\n"),
                                ),
                              ),
                              Effect.flatMap((embed) =>
                                pipe(
                                  SendableChannelContext.send().sync({
                                    content: pipe(monitorInfo.mention, Option.getOrUndefined),
                                    embeds: [embed],
                                    allowedMentions: pipe(
                                      monitorInfo.mentionUserId,
                                      Option.match({
                                        onSome: (userId) => ({ users: [userId] }),
                                        onNone: () => ({ parse: [] as const }),
                                      }),
                                    ),
                                  }),
                                  Effect.provide(
                                    channelServicesFromGuildChannelId(
                                      checkinData.runningChannel.channelId,
                                    ),
                                  ),
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
