import {
  bold,
  escapeMarkdown,
  time,
  TimestampStyles,
  userMention,
} from "discord.js";
import { Array, Effect, HashSet, Option, pipe } from "effect";
import { PlayerService } from "./playerService";
import { Schedule } from "./sheetService";

export const emptySchedule = (hour: number): Schedule => ({
  hour,
  breakHour: false,
  fills: [undefined, undefined, undefined, undefined, undefined],
  overfills: [],
  standbys: [],
  empty: 5,
});

export class ScheduleService extends Effect.Service<ScheduleService>()(
  "ScheduleService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("playerService", () => PlayerService),
      Effect.map(({ playerService }) => ({
        formatEmptySlots: (
          start: number,
          { hour, breakHour, empty }: Schedule,
        ) => {
          return empty > 0 && !breakHour
            ? `${bold(`+${empty} Hour ${hour}`)} ${time(start + (hour - 1) * 3600, TimestampStyles.ShortTime)} to ${time(start + hour * 3600, TimestampStyles.ShortTime)}`
            : "";
        },
        formatCheckinEmptySlots: ({ empty }: Schedule) =>
          `Checkin message sent! (${empty > 0 ? `+${empty}` : "No"} empty slot${
            empty > 1 ? "s" : ""
          })`,
        formatCheckIn: ({
          channelName,
          startTime,
          prevSchedule,
          schedule,
        }: {
          startTime: number;
          prevSchedule: Schedule;
          schedule: Schedule;
          channelName: string;
        }) => {
          return pipe(
            Effect.Do,
            Effect.let("prevFills", () =>
              Array.filter(prevSchedule.fills, (fill) => fill !== undefined),
            ),
            Effect.let("fills", () =>
              Array.filter(schedule.fills, (fill) => fill !== undefined),
            ),
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
            Effect.map(({ fillsPlayers, prevFillsPlayers }) => {
              const newPlayerMentions = pipe(
                HashSet.fromIterable(fillsPlayers),
                HashSet.difference(
                  pipe(HashSet.fromIterable(prevFillsPlayers)),
                ),
              );
              return `${HashSet.toValues(newPlayerMentions).join(" ")} React to this message to check in, and head to ${channelName} for ${bold(`hour ${schedule.hour}`)} ${time(startTime + (schedule.hour - 1) * 3600, TimestampStyles.RelativeTime)}`;
            }),
            Effect.withSpan("ScheduleService.formatCheckIn", {
              captureStackTrace: true,
            }),
          );
        },
      })),
    ),
    accessors: true,
  },
) {}
