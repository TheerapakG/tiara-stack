import {
  bold,
  escapeMarkdown,
  time,
  TimestampStyles,
  userMention,
} from "discord.js";
import { Array, Data, Effect, HashSet, Option, pipe } from "effect";
import { PlayerService } from "./playerService";
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
      Effect.bind("playerService", () => PlayerService),
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
      Effect.map(({ playerService, formatHour }) => ({
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
        formatCheckinEmptySlots: ({ empty }: Schedule) =>
          pipe(
            Effect.succeed(
              `Checkin message sent! (${empty > 0 ? `+${empty}` : "No"} empty slot${
                empty > 1 ? "s" : ""
              })`,
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
          prevSchedule: Schedule;
          schedule: Schedule;
          channelString: string;
        }) =>
          pipe(
            Effect.Do,
            Effect.let("prevFills", () => Array.getSomes(prevSchedule.fills)),
            Effect.let("fills", () => Array.getSomes(schedule.fills)),
            Effect.bind("fillsPlayers", ({ fills }) =>
              Effect.forEach(fills, (player) =>
                pipe(
                  playerService.getByName(player),
                  Effect.map(
                    Option.match({
                      onSome: (p) => userMention(p.id),
                      onNone: () => escapeMarkdown(player),
                    }),
                  ),
                ),
              ),
            ),
            Effect.bind("prevFillsPlayers", ({ prevFills }) =>
              Effect.forEach(prevFills, (player) =>
                pipe(
                  playerService.getByName(player),
                  Effect.map(
                    Option.match({
                      onSome: (p) => userMention(p.id),
                      onNone: () => escapeMarkdown(player),
                    }),
                  ),
                ),
              ),
            ),
            Effect.bind("range", () => formatHour(schedule.hour)),
            Effect.map(({ fillsPlayers, prevFillsPlayers, range }) => {
              const newPlayerMentions = pipe(
                HashSet.fromIterable(fillsPlayers),
                HashSet.difference(
                  pipe(HashSet.fromIterable(prevFillsPlayers)),
                ),
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
