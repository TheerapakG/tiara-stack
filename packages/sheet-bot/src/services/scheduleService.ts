import {
  bold,
  channelMention,
  time,
  TimestampStyles,
  userMention,
} from "discord.js";
import { Array, Effect, HashMap, HashSet, Option, pipe } from "effect";
import { Schedule, ScheduleMap, SheetService } from "./sheetService";

const emptySchedule = (hour: number): Schedule => ({
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
      Effect.map(() => ({
        formatEmptySlots: (
          start: number,
          { hour, breakHour, empty }: Schedule,
        ) => {
          return empty > 0 && !breakHour
            ? `${bold(`+${empty} Hour ${hour}`)} ${time(start + (hour - 1) * 3600, TimestampStyles.ShortTime)} to ${time(start + hour * 3600, TimestampStyles.ShortTime)}`
            : "";
        },
        formatCheckIn: (
          hour: number,
          channelId: string,
          start: number,
          schedules: ScheduleMap,
        ) => {
          return pipe(
            Effect.Do,
            Effect.let("prevFills", () =>
              pipe(
                HashMap.get(schedules, hour - 1),
                Option.getOrElse(() => emptySchedule(hour - 1)),
                ({ fills }) =>
                  Array.filter(fills, (fill) => fill !== undefined),
              ),
            ),
            Effect.let("fills", () =>
              pipe(
                HashMap.get(schedules, hour),
                Option.getOrElse(() => emptySchedule(hour)),
                ({ fills }) =>
                  Array.filter(fills, (fill) => fill !== undefined),
              ),
            ),
            Effect.bind("playerMap", () =>
              pipe(
                SheetService.getPlayers(),
                Effect.map(
                  Array.map(({ id, name }) =>
                    Option.isSome(id) && Option.isSome(name)
                      ? Option.some({ id: id.value, name: name.value })
                      : Option.none(),
                  ),
                ),
                Effect.map(Array.getSomes),
                Effect.map(Array.map(({ id, name }) => [name, id] as const)),
                Effect.map(HashMap.fromIterable),
              ),
            ),
            Effect.map(({ fills, prevFills, playerMap }) => {
              const newPlayerMentions = pipe(
                HashSet.fromIterable(fills),
                HashSet.map((player) =>
                  pipe(
                    HashMap.get(playerMap, player),
                    Option.match({
                      onSome: (id) => userMention(id),
                      onNone: () => player,
                    }),
                  ),
                ),
                HashSet.difference(
                  pipe(
                    HashSet.fromIterable(prevFills),
                    HashSet.map((player) =>
                      pipe(
                        HashMap.get(playerMap, player),
                        Option.match({
                          onSome: (id) => userMention(id),
                          onNone: () => player,
                        }),
                      ),
                    ),
                  ),
                ),
              );
              return `${HashSet.toValues(newPlayerMentions).join(" ")} React to this message to check in, and head to ${channelMention(channelId)} for ${bold(`hour ${hour}`)} ${time(start + (hour - 1) * 3600, TimestampStyles.RelativeTime)}`;
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
