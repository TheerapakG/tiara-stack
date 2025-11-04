import { bold, time, TimestampStyles, userMention } from "discord.js";
import {
  Array,
  Data,
  DateTime,
  Effect,
  HashSet,
  Match,
  Number,
  Option,
  Order,
  pipe,
} from "effect";
import { ConverterService, HourWindow } from "./converterService";
import { Schema } from "sheet-apis";

export class FormattedHourWindow extends Data.TaggedClass(
  "FormattedHourWindow",
)<{
  start: number;
  end: number;
}> {}

export class FormatService extends Effect.Service<FormatService>()(
  "FormatService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("converterService", () => ConverterService),
      Effect.let(
        "formatDateTime",
        () => (dateTime: DateTime.DateTime) =>
          pipe(dateTime, DateTime.toEpochMillis, Number.unsafeDivide(1000)),
      ),
      Effect.let(
        "formatHourWindow",
        ({ formatDateTime }) =>
          (hourWindow: HourWindow) =>
            new FormattedHourWindow({
              start: formatDateTime(hourWindow.start),
              end: formatDateTime(hourWindow.end),
            }),
      ),
      Effect.map(({ converterService, formatDateTime, formatHourWindow }) => ({
        formatDateTime,
        formatHourWindow,
        formatOpenSlot: (
          schedule:
            | Schema.EmptySchedule
            | Schema.EmptyScheduleWithPlayers
            | Schema.Schedule
            | Schema.ScheduleWithPlayers,
        ) =>
          pipe(
            Effect.succeed({
              hour: schedule.hour,
              breakHour: schedule.breakHour,
              empty: pipe(
                Match.value(schedule),
                Match.tagsExhaustive({
                  EmptySchedule: (schedule) => Schema.Schedule.empty(schedule),
                  Schedule: (schedule) => Schema.Schedule.empty(schedule),
                  EmptyScheduleWithPlayers: (schedule) =>
                    Schema.ScheduleWithPlayers.empty(schedule),
                  ScheduleWithPlayers: (schedule) =>
                    Schema.ScheduleWithPlayers.empty(schedule),
                }),
              ),
            }),
            Effect.flatMap(({ hour, breakHour, empty }) =>
              Order.greaterThan(Number.Order)(empty, 0) && !breakHour
                ? pipe(
                    hour,
                    Effect.transposeMapOption(
                      converterService.convertHourToHourWindow,
                    ),
                    Effect.map(Option.map(formatHourWindow)),
                    Effect.map(
                      (range) =>
                        `${bold(
                          `+${empty} | ${pipe(
                            hour,
                            Option.getOrElse(() => "?"),
                          )}`,
                        )} ${pipe(
                          range,
                          Option.map(({ start }) =>
                            time(start, TimestampStyles.ShortTime),
                          ),
                          Option.getOrElse(() => "?"),
                        )}-${pipe(
                          range,
                          Option.map(({ end }) =>
                            time(end, TimestampStyles.ShortTime),
                          ),
                          Option.getOrElse(() => "?"),
                        )}`,
                    ),
                  )
                : Effect.succeed(""),
            ),
            Effect.withSpan("FormatService.formatOpenSlot", {
              captureStackTrace: true,
            }),
          ),
        formatFilledSlot: (
          schedule:
            | Schema.EmptySchedule
            | Schema.EmptyScheduleWithPlayers
            | Schema.Schedule
            | Schema.ScheduleWithPlayers,
        ) =>
          pipe(
            Effect.succeed({
              hour: schedule.hour,
              breakHour: schedule.breakHour,
              empty: pipe(
                Match.value(schedule),
                Match.tagsExhaustive({
                  EmptySchedule: (schedule) => Schema.Schedule.empty(schedule),
                  Schedule: (schedule) => Schema.Schedule.empty(schedule),
                  EmptyScheduleWithPlayers: (schedule) =>
                    Schema.ScheduleWithPlayers.empty(schedule),
                  ScheduleWithPlayers: (schedule) =>
                    Schema.ScheduleWithPlayers.empty(schedule),
                }),
              ),
            }),
            Effect.flatMap(({ hour, breakHour, empty }) =>
              Number.Equivalence(empty, 0) && !breakHour
                ? pipe(
                    hour,
                    Effect.transposeMapOption(
                      converterService.convertHourToHourWindow,
                    ),
                    Effect.map(Option.map(formatHourWindow)),
                    Effect.map(
                      (range) =>
                        `${bold(
                          `${pipe(
                            hour,
                            Option.getOrElse(() => "?"),
                          )}`,
                        )} ${pipe(
                          range,
                          Option.map(({ start }) =>
                            time(start, TimestampStyles.ShortTime),
                          ),
                          Option.getOrElse(() => "?"),
                        )}-${pipe(
                          range,
                          Option.map(({ end }) =>
                            time(end, TimestampStyles.ShortTime),
                          ),
                          Option.getOrElse(() => "?"),
                        )}`,
                    ),
                  )
                : Effect.succeed(""),
            ),
            Effect.withSpan("FormatService.formatFilledSlot", {
              captureStackTrace: true,
            }),
          ),
        formatCheckIn: ({
          prevSchedule,
          schedule,
          channelString,
        }: {
          prevSchedule:
            | Schema.ScheduleWithPlayers
            | Schema.EmptyScheduleWithPlayers;
          schedule:
            | Schema.ScheduleWithPlayers
            | Schema.EmptyScheduleWithPlayers;
          channelString: string;
        }) =>
          pipe(
            Effect.Do,
            Effect.let("prevFills", () =>
              prevSchedule.breakHour
                ? []
                : pipe(
                    Schema.ScheduleWithPlayers.getFills(prevSchedule),
                    Array.getSomes,
                    Array.map((player) =>
                      pipe(
                        Match.value(player),
                        Match.tagsExhaustive({
                          Player: (player) => userMention(player.id),
                          PartialNamePlayer: (player) => player.name,
                        }),
                      ),
                    ),
                  ),
            ),
            Effect.let("fills", () =>
              schedule.breakHour
                ? []
                : pipe(
                    Schema.ScheduleWithPlayers.getFills(schedule),
                    Array.getSomes,
                    Array.map((player) =>
                      pipe(
                        Match.value(player),
                        Match.tagsExhaustive({
                          Player: (player) => userMention(player.id),
                          PartialNamePlayer: (player) => player.name,
                        }),
                      ),
                    ),
                  ),
            ),
            Effect.bind("range", () =>
              pipe(
                schedule.hour,
                Effect.transposeMapOption(
                  converterService.convertHourToHourWindow,
                ),
                Effect.map(Option.map(formatHourWindow)),
              ),
            ),
            Effect.let("checkinMessage", ({ fills, prevFills, range }) =>
              pipe(
                HashSet.fromIterable(fills),
                HashSet.difference(pipe(HashSet.fromIterable(prevFills))),
                HashSet.toValues,
                Option.some,
                Option.filter(Array.isNonEmptyArray),
                Option.map(Array.join(" ")),
                Option.map(
                  (mentions) =>
                    `${mentions} React to this message to check in, and ${channelString}${pipe(
                      schedule.hour,
                      Option.map((hour) => ` for ${bold(`hour ${hour}`)}`),
                      Option.getOrElse(() => ""),
                    )}${pipe(
                      range,
                      Option.map(({ start }) =>
                        time(start, TimestampStyles.RelativeTime),
                      ),
                      Option.getOrElse(() => ""),
                    )}`,
                ),
              ),
            ),
            Effect.let("empty", () =>
              Schema.ScheduleWithPlayers.empty(schedule),
            ),
            Effect.let(
              "emptySlotMessage",
              ({ empty }) =>
                `${
                  Order.greaterThan(Number.Order)(empty, 0) ? `+${empty}` : "No"
                } empty slot${Order.greaterThan(Number.Order)(empty, 1) ? "s" : ""}`,
            ),
            Effect.let(
              "playersMessage",
              ({ fills }) => `Players: ${pipe(fills, Array.join(" "))}`,
            ),
            Effect.let("lookupFailedMessage", () =>
              pipe(
                Schema.ScheduleWithPlayers.getFills(schedule),
                Array.getSomes,
                Array.map((player) =>
                  pipe(
                    Match.value(player),
                    Match.tagsExhaustive({
                      Player: () => Option.none(),
                      PartialNamePlayer: (player) => Option.some(player),
                    }),
                  ),
                ),
                Array.getSomes,
                Option.liftPredicate((partialPlayers) =>
                  pipe(
                    partialPlayers,
                    Array.length,
                    Order.greaterThan(Number.Order)(0),
                  ),
                ),
                Option.map(
                  (partialPlayers) =>
                    `Cannot look up Discord ID for ${pipe(
                      partialPlayers,
                      Array.map((player) => player.name),
                      Array.join(", "),
                    )}. They would need to check in manually.`,
                ),
              ),
            ),
            Effect.map(
              ({
                checkinMessage,
                emptySlotMessage,
                playersMessage,
                lookupFailedMessage,
              }) => ({
                checkinMessage,
                managerCheckinMessage: pipe(
                  checkinMessage,
                  Option.match({
                    onSome: () =>
                      pipe(
                        [
                          Option.some("Checkin message sent!"),
                          Option.some(emptySlotMessage),
                          Option.some(playersMessage),
                          lookupFailedMessage,
                        ],
                        Array.getSomes,
                        Array.join("\n"),
                      ),
                    onNone: () => "No checkin message sent, no players changed",
                  }),
                ),
              }),
            ),
            Effect.withSpan("FormatService.formatCheckIn", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {}
