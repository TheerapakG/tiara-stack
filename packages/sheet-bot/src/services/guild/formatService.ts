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
import {
  PartialNamePlayer,
  Player,
  ScheduleWithPlayers,
} from "./playerService";
import { Schedule } from "./sheetService";

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
        formatEmptySlots: ({ hour, breakHour, empty }: Schedule) =>
          pipe(
            Effect.succeed({ hour, breakHour, empty }),
            Effect.flatMap(({ hour, breakHour, empty }) =>
              Order.greaterThan(Order.number)(empty, 0) && !breakHour
                ? pipe(
                    converterService.convertHourToHourWindow(hour),
                    Effect.map(formatHourWindow),
                    Effect.map(
                      ({ start, end }) =>
                        `${bold(`+${empty} Hour ${hour}`)} ${time(start, TimestampStyles.ShortTime)} to ${time(end, TimestampStyles.ShortTime)}`,
                    ),
                  )
                : Effect.succeed(""),
            ),
            Effect.withSpan("FormatService.formatEmptySlots", {
              captureStackTrace: true,
            }),
          ),
        formatManagerCheckinMessage: ({ fills, empty }: ScheduleWithPlayers) =>
          pipe(
            Effect.succeed(
              pipe(
                [
                  Option.some(
                    `Checkin message sent! (${
                      Order.greaterThan(Order.number)(empty, 0)
                        ? `+${empty}`
                        : "No"
                    } empty slot${Order.greaterThan(Order.number)(empty, 1) ? "s" : ""})`,
                  ),
                  pipe(
                    fills,
                    Array.getSomes,
                    Array.map((player) =>
                      pipe(
                        Match.type<Player | PartialNamePlayer>(),
                        Match.tag("Player", () => Option.none()),
                        Match.tag("PartialNamePlayer", (player) =>
                          Option.some(player),
                        ),
                        Match.exhaustive,
                        Function.apply(player),
                      ),
                    ),
                    Array.getSomes,
                    (partialPlayers) =>
                      Order.greaterThan(Order.number)(
                        pipe(partialPlayers, Array.length),
                        0,
                      )
                        ? Option.some(
                            `Cannot look up Discord ID for ${pipe(
                              partialPlayers,
                              Array.map((player) => player.name),
                              Array.join(", "),
                            )}. They would need to check in manually.`,
                          )
                        : Option.none(),
                  ),
                ],
                Array.getSomes,
                Array.join("\n"),
              ),
            ),
            Effect.withSpan("FormatService.formatCheckinEmptySlots", {
              captureStackTrace: true,
            }),
          ),
        formatCheckIn: ({
          prevSchedule,
          schedule,
          channelString,
        }: {
          prevSchedule: ScheduleWithPlayers;
          schedule: ScheduleWithPlayers;
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
                        Match.type<Player | PartialNamePlayer>(),
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
                        Match.type<Player | PartialNamePlayer>(),
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
            Effect.map(({ fills, prevFills, range }) => {
              const newPlayerMentions = pipe(
                HashSet.fromIterable(fills),
                HashSet.difference(pipe(HashSet.fromIterable(prevFills))),
              );
              return `${HashSet.toValues(newPlayerMentions).join(" ")} React to this message to check in, and ${channelString} for ${bold(`hour ${schedule.hour}`)} ${time(range.start, TimestampStyles.RelativeTime)}`;
            }),
            Effect.withSpan("FormatService.formatCheckIn", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {}
