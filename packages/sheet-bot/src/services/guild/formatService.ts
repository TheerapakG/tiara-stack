import { bold, time, TimestampStyles, userMention } from "discord.js";
import {
  Array,
  Data,
  DateTime,
  Effect,
  Function,
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
          schedule: Schema.Schedule | Schema.ScheduleWithPlayers,
        ) =>
          pipe(
            Effect.succeed({
              hour: schedule.hour,
              breakHour: schedule.breakHour,
              empty: pipe(
                Match.value(schedule),
                Match.tagsExhaustive({
                  Schedule: (schedule) => Schema.Schedule.empty(schedule),
                  ScheduleWithPlayers: (schedule) =>
                    Schema.ScheduleWithPlayers.empty(schedule),
                }),
              ),
            }),
            Effect.flatMap(({ hour, breakHour, empty }) =>
              Order.greaterThan(Number.Order)(empty, 0) && !breakHour
                ? pipe(
                    converterService.convertHourToHourWindow(hour),
                    Effect.map(formatHourWindow),
                    Effect.map(
                      ({ start, end }) =>
                        `${bold(`+${empty} | ${hour}`)} ${time(start, TimestampStyles.ShortTime)}-${time(end, TimestampStyles.ShortTime)}`,
                    ),
                  )
                : Effect.succeed(""),
            ),
            Effect.withSpan("FormatService.formatOpenSlot", {
              captureStackTrace: true,
            }),
          ),
        formatFilledSlot: (
          schedule: Schema.Schedule | Schema.ScheduleWithPlayers,
        ) =>
          pipe(
            Effect.succeed({
              hour: schedule.hour,
              breakHour: schedule.breakHour,
              empty: pipe(
                Match.value(schedule),
                Match.tagsExhaustive({
                  Schedule: (schedule) => Schema.Schedule.empty(schedule),
                  ScheduleWithPlayers: (schedule) =>
                    Schema.ScheduleWithPlayers.empty(schedule),
                }),
              ),
            }),
            Effect.flatMap(({ hour, breakHour, empty }) =>
              Number.Equivalence(empty, 0) && !breakHour
                ? pipe(
                    converterService.convertHourToHourWindow(hour),
                    Effect.map(formatHourWindow),
                    Effect.map(
                      ({ start, end }) =>
                        `${bold(`${hour}`)} ${time(start, TimestampStyles.ShortTime)}-${time(end, TimestampStyles.ShortTime)}`,
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
          prevSchedule: Schema.ScheduleWithPlayers;
          schedule: Schema.ScheduleWithPlayers;
          channelString: string;
        }) =>
          pipe(
            Effect.Do,
            Effect.let("prevFills", () =>
              prevSchedule.breakHour
                ? []
                : pipe(
                    prevSchedule.fills,
                    Array.getSomes,
                    Array.map((player) =>
                      pipe(
                        Match.type<Schema.Player | Schema.PartialNamePlayer>(),
                        Match.tag("Player", (player) => userMention(player.id)),
                        Match.tag("PartialNamePlayer", (player) => player.name),
                        Match.exhaustive,
                        Function.apply(player),
                      ),
                    ),
                  ),
            ),
            Effect.let("fills", () =>
              schedule.breakHour
                ? []
                : pipe(
                    schedule.fills,
                    Array.getSomes,
                    Array.map((player) =>
                      pipe(
                        Match.type<Schema.Player | Schema.PartialNamePlayer>(),
                        Match.tag("Player", (player) => userMention(player.id)),
                        Match.tag("PartialNamePlayer", (player) => player.name),
                        Match.exhaustive,
                        Function.apply(player),
                      ),
                    ),
                  ),
            ),
            Effect.bind("range", () =>
              pipe(
                converterService.convertHourToHourWindow(schedule.hour),
                Effect.map(formatHourWindow),
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
                    `${mentions} React to this message to check in, and ${channelString} for ${bold(`hour ${schedule.hour}`)} ${time(range.start, TimestampStyles.RelativeTime)}`,
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
                schedule.fills,
                Array.getSomes,
                Array.map((player) =>
                  pipe(
                    Match.type<Schema.Player | Schema.PartialNamePlayer>(),
                    Match.tag("Player", () => Option.none()),
                    Match.tag("PartialNamePlayer", (player) =>
                      Option.some(player),
                    ),
                    Match.exhaustive,
                    Function.apply(player),
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
