import {
  bold,
  channelMention,
  time,
  TimestampStyles,
  userMention,
} from "discord.js";
import { Array, Effect, HashMap, HashSet, Option, pipe } from "effect";
import { GoogleSheets } from "../google";
import { GuildConfigService } from "./guildConfigService";
import { SheetService } from "./sheetService";

type Schedule = {
  hour: number;
  breakHour: boolean;
  players: readonly [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ];
  empty: number;
};

const emptySchedule = (hour: number): Schedule => ({
  hour,
  breakHour: false,
  players: [undefined, undefined, undefined, undefined, undefined],
  empty: 5,
});

export class ScheduleService extends Effect.Service<ScheduleService>()(
  "ScheduleService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("guildConfigService", () => GuildConfigService),
      Effect.bind("googleSheets", () => GoogleSheets),
      Effect.map(() => ({
        list: () =>
          pipe(
            Effect.Do,
            Effect.bind("eventConfig", () => SheetService.getEventConfig()),
            Effect.bind("rangesConfig", () => SheetService.getRangesConfig()),
            Effect.bind("sheet", ({ rangesConfig }) =>
              SheetService.get({
                ranges: [
                  rangesConfig.hours,
                  rangesConfig.breaks,
                  rangesConfig.hourPlayers,
                ],
              }),
            ),
            Effect.let("daySchedule", ({ eventConfig, sheet }) => {
              const start = eventConfig.startTime;
              const [hours, breaks, schedules] = sheet.data.valueRanges ?? [];
              const hourObjects = (hours.values ?? []).map(([hour]) => {
                return {
                  hour: Number(hour),
                };
              });
              const breakObjects = (breaks.values ?? []).map(([breakHour]) => {
                return {
                  breakHour: breakHour === "TRUE",
                };
              });
              const scheduleObjects = (schedules.values ?? []).map(
                ([p1, p2, p3, p4, p5]) => {
                  return {
                    players: [
                      p1 !== undefined ? String(p1) : undefined,
                      p2 !== undefined ? String(p2) : undefined,
                      p3 !== undefined ? String(p3) : undefined,
                      p4 !== undefined ? String(p4) : undefined,
                      p5 !== undefined ? String(p5) : undefined,
                    ],
                  } as const;
                },
              );

              return {
                start,
                schedules: pipe(
                  hourObjects,
                  Array.zip(breakObjects),
                  Array.map(([acc, obj]) => ({ ...acc, ...obj })),
                  Array.zip(scheduleObjects),
                  Array.map(([acc, obj]) => ({ ...acc, ...obj })),
                  Array.map(({ hour, breakHour, players }) => ({
                    hour,
                    breakHour,
                    players,
                    empty: 5 - players.filter(Boolean).length,
                  })),
                  Array.filter(({ hour }) => !isNaN(hour)),
                  Array.map(
                    ({ hour, breakHour, players, empty }) =>
                      [hour, { hour, breakHour, players, empty }] as const,
                  ),
                  HashMap.fromIterable,
                ),
              };
            }),
            Effect.map(({ daySchedule }) => daySchedule),
            Effect.withSpan("ScheduleService.list", {
              captureStackTrace: true,
            }),
          ),
        listDay: (day: number) =>
          pipe(
            Effect.Do,
            Effect.bind("eventConfig", () => SheetService.getEventConfig()),
            Effect.bind("sheet", () =>
              SheetService.get({
                ranges: [`'Day ${day}'!C3:C`, `'Day ${day}'!J3:O`],
              }),
            ),
            Effect.let("daySchedule", ({ eventConfig, sheet }) => {
              const start = eventConfig.startTime;
              const [breaks, schedules] = sheet.data.valueRanges ?? [];

              return {
                start,
                schedules:
                  Array.zip(breaks.values ?? [], schedules.values ?? [])
                    ?.map(([[breakHour], [hour, p1, p2, p3, p4, p5]]) => {
                      return {
                        hour: Number(hour),
                        breakHour: breakHour === "TRUE",
                        players: [
                          p1 !== undefined ? String(p1) : undefined,
                          p2 !== undefined ? String(p2) : undefined,
                          p3 !== undefined ? String(p3) : undefined,
                          p4 !== undefined ? String(p4) : undefined,
                          p5 !== undefined ? String(p5) : undefined,
                        ],
                      } as const;
                    })
                    ?.map(({ hour, breakHour, players }) => ({
                      hour,
                      breakHour,
                      players,
                      empty: 5 - players.filter(Boolean).length,
                    }))
                    ?.filter(({ hour }) => !isNaN(hour)) ?? [],
              };
            }),
            Effect.map(({ daySchedule }) => daySchedule),
            Effect.withSpan("ScheduleService.listDay", {
              captureStackTrace: true,
            }),
          ),
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
          schedules: HashMap.HashMap<number, Schedule>,
        ) => {
          return pipe(
            Effect.Do,
            Effect.let("prevPlayers", () =>
              pipe(
                HashMap.get(schedules, hour - 1),
                Option.getOrElse(() => emptySchedule(hour - 1)),
                ({ players }) =>
                  Array.filter(players, (player) => player !== undefined),
              ),
            ),
            Effect.let("players", () =>
              pipe(
                HashMap.get(schedules, hour),
                Option.getOrElse(() => emptySchedule(hour)),
                ({ players }) =>
                  Array.filter(players, (player) => player !== undefined),
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
            Effect.map(({ players, prevPlayers, playerMap }) => {
              const newPlayerMentions = pipe(
                HashSet.fromIterable(players),
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
                    HashSet.fromIterable(prevPlayers),
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
    dependencies: [GuildConfigService.Default, GoogleSheets.Default],
    accessors: true,
  },
) {}
