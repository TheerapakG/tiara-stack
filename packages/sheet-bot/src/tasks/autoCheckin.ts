import { checkinButton } from "@/messageComponents";
import {
  channelServicesFromGuildChannelId,
  ConverterService,
  FormatService,
  GuildConfigService,
  SendableChannelContext,
  SheetService,
} from "@/services";
import { guildServices } from "@/services/collection/guildServices";
import { MessageCheckinService } from "@/services/bot";
import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageActionRowComponentBuilder,
} from "discord.js";
import {
  Array,
  DateTime,
  Effect,
  HashSet,
  Option,
  Schedule,
  Cron,
  pipe,
} from "effect";

const computeHour = pipe(
  Effect.Do,
  Effect.bind("now", () => DateTime.now),
  Effect.map(({ now }) => DateTime.addDuration("20 minutes")(now)),
  Effect.flatMap((dt) => ConverterService.convertDateTimeToHour(dt)),
);

const getCheckinData = ({
  hour,
  runningChannel,
}: {
  hour: number;
  runningChannel: {
    channelId: string;
    name: Option.Option<string>;
    roleId: Option.Option<string>;
  };
}) =>
  pipe(
    Effect.Do,
    Effect.bind("channelName", () => Effect.succeed(runningChannel.name)),
    Effect.bind("schedulesRaw", ({ channelName }) =>
      pipe(
        channelName,
        Option.match({
          onSome: (name) => SheetService.channelSchedules(name),
          onNone: () => Effect.succeed([] as readonly unknown[]),
        }),
      ),
    ),
    Effect.map(({ schedulesRaw }) => {
      const prevSchedule = Array.findFirst(
        schedulesRaw as ReadonlyArray<any>,
        (s) => Option.getOrNull(s.hour as Option.Option<number>) === hour - 1,
      );
      const schedule = Array.findFirst(
        schedulesRaw as ReadonlyArray<any>,
        (s) => Option.getOrNull(s.hour as Option.Option<number>) === hour,
      );
      return {
        prevSchedule,
        schedule,
      };
    }),
    Effect.map(({ prevSchedule, schedule }) => ({
      prevSchedule,
      schedule,
      runningChannel,
      showChannelMention: Option.isNone(runningChannel.roleId),
    })),
  );

const getCheckinMessages = (data: {
  prevSchedule: Option.Option<any>;
  schedule: Option.Option<any>;
  runningChannel: {
    channelId: string;
    name: Option.Option<string>;
    roleId: Option.Option<string>;
  };
  showChannelMention: boolean;
}) =>
  FormatService.formatCheckIn({
    prevSchedule: data.prevSchedule,
    schedule: data.schedule,
    channelString: data.showChannelMention
      ? `<#${data.runningChannel.channelId}>`
      : pipe(
          data.runningChannel.name,
          Option.map((name) => `head to ${name}`),
          Option.getOrElse(
            () =>
              "await further instructions from the manager on where the running channel is",
          ),
        ),
    template: undefined,
  });

const runOnce = pipe(
  Effect.Do,
  Effect.bind("guilds", () => GuildConfigService.getAutoCheckinGuilds()),
  Effect.bind("guildCounts", ({ guilds }) =>
    pipe(
      Effect.forEach(guilds, (guild) =>
        Effect.provide(guildServices(guild.guildId))(
          pipe(
            Effect.Do,
            Effect.bind("hour", () => computeHour),
            Effect.bind("allSchedules", () => SheetService.allSchedules),
            Effect.let("channels", ({ allSchedules }) =>
              pipe(
                allSchedules as ReadonlyArray<unknown>,
                Array.map((s) => (s as any).channel as string),
                (names) => HashSet.fromIterable(names as Iterable<string>),
                HashSet.toValues,
              ),
            ),
            Effect.flatMap(({ hour, channels }) =>
              pipe(
                Effect.forEach(
                  channels,
                  (channelName) =>
                    pipe(
                      GuildConfigService.getGuildRunningChannelByName(
                        channelName,
                      ),
                      Effect.flatMap((runningChannel) =>
                        pipe(
                          Effect.Do,
                          Effect.bind("checkinChannelId", () =>
                            pipe(
                              runningChannel.checkinChannelId,
                              Option.match({
                                onSome: Effect.succeed,
                                onNone: () =>
                                  Effect.succeed(runningChannel.channelId),
                              }),
                            ),
                          ),
                          Effect.bind("checkinData", () =>
                            getCheckinData({ hour, runningChannel }),
                          ),
                          Effect.bind("checkinMessages", ({ checkinData }) =>
                            getCheckinMessages(checkinData),
                          ),
                          Effect.bind(
                            "message",
                            ({
                              checkinData,
                              checkinMessages,
                              checkinChannelId,
                            }) =>
                              pipe(
                                checkinMessages.checkinMessage,
                                Effect.transposeMapOption((checkinMessage) =>
                                  pipe(
                                    Effect.Do,
                                    Effect.let(
                                      "initialMessage",
                                      () => checkinMessage,
                                    ),
                                    SendableChannelContext.send().bind(
                                      "message",
                                      () => ({
                                        content: checkinMessage,
                                        components: checkinData.runningChannel
                                          .roleId
                                          ? [
                                              new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                                                new ButtonBuilder(
                                                  checkinButton.data,
                                                ),
                                              ),
                                            ]
                                          : [],
                                      }),
                                    ),
                                  ),
                                ),
                                Effect.provide(
                                  channelServicesFromGuildChannelId(
                                    checkinChannelId,
                                  ),
                                ),
                              ),
                          ),
                          Effect.tap(({ checkinData, message }) =>
                            pipe(
                              message,
                              Effect.transposeMapOption(
                                ({ initialMessage, message }) =>
                                  MessageCheckinService.upsertMessageCheckinData(
                                    message.id,
                                    {
                                      initialMessage,
                                      hour,
                                      channelId:
                                        checkinData.runningChannel.channelId,
                                      roleId: Option.getOrNull(
                                        checkinData.runningChannel.roleId,
                                      ),
                                    },
                                  ),
                              ),
                            ),
                          ),
                          Effect.map(({ message }) =>
                            Option.isSome(message) ? 1 : 0,
                          ),
                        ),
                      ),
                      Effect.catchAll(() => Effect.succeed(0)),
                    ),
                  { concurrency: "unbounded" },
                ),
                Effect.map((counts) =>
                  counts.reduce((acc: number, n: number) => acc + n, 0),
                ),
                Effect.tap((sent) =>
                  Effect.log(
                    `autoCheckin: sent ${sent} check-in message(s) for guild ${guild.guildId}`,
                  ),
                ),
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
    Effect.log(
      `sent ${total} check-in message(s) across all ${guildCounts.length} guilds`,
    ),
  ),
  Effect.withSpan("autoCheckin.runOnce", { captureStackTrace: true }),
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
