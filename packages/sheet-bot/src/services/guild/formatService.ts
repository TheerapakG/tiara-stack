import { bold, time, TimestampStyles, userMention } from "discord.js";
import {
  Array,
  Data,
  Effect,
  Function,
  HashSet,
  Match,
  Option,
  pipe,
} from "effect";
import {
  PartialNamePlayer,
  Player,
  ScheduleWithPlayers,
} from "./playerService";
import { Schedule, SheetService } from "./sheetService";

class HourWindow extends Data.TaggedClass("HourWindow")<{
  start: number;
  end: number;
}> {}

export class FormatService extends Effect.Service<FormatService>()(
  "FormatService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("sheetService", () => SheetService),
      Effect.let(
        "formatHour",
        ({ sheetService }) =>
          (hour: number) =>
            pipe(
              sheetService.getEventConfig(),
              Effect.map(
                (eventConfig) =>
                  new HourWindow({
                    start: eventConfig.startTime + (hour - 1) * 3600,
                    end: eventConfig.startTime + hour * 3600,
                  }),
              ),
              Effect.withSpan("FormatService.formatHour", {
                captureStackTrace: true,
              }),
            ),
      ),
      Effect.map(({ formatHour }) => ({
        formatHour,
        formatEmptySlots: ({ hour, breakHour, empty }: Schedule) =>
          pipe(
            Effect.succeed({ hour, breakHour, empty }),
            Effect.flatMap(({ hour, breakHour, empty }) =>
              empty > 0 && !breakHour
                ? pipe(
                    formatHour(hour),
                    Effect.map(
                      (range) =>
                        `${bold(`+${empty} Hour ${hour}`)} ${time(range.start, TimestampStyles.ShortTime)} to ${time(range.end, TimestampStyles.ShortTime)}`,
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
                    `Checkin message sent! (${empty > 0 ? `+${empty}` : "No"} empty slot${
                      empty > 1 ? "s" : ""
                    })`,
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
                      partialPlayers.length > 0
                        ? Option.some(
                            `Cannot look up Discord ID for ${partialPlayers.join(
                              ", ",
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
              pipe(
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
              pipe(
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
            Effect.bind("range", () => formatHour(schedule.hour)),
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
