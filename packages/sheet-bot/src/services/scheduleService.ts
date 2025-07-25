import { bold, time, TimestampStyles } from "discord.js";
import { Array, Effect, HashMap, HashSet, Option, pipe } from "effect";
import { observeEffectSignalOnce } from "typhoon-server/signal";
import { GoogleSheets } from "../google";
import { GuildConfigService } from "./guildConfigService";
import { SheetConfigService } from "./sheetConfigService";

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
      Effect.map(({ guildConfigService, googleSheets }) => ({
        list: (serverId: string) =>
          pipe(
            Effect.Do,
            Effect.bind("guildConfig", () =>
              observeEffectSignalOnce(guildConfigService.getConfig(serverId)),
            ),
            Effect.bind("sheetId", ({ guildConfig }) =>
              Option.fromNullable(guildConfig[0].sheetId),
            ),
            Effect.bind("eventConfig", ({ sheetId }) =>
              SheetConfigService.getEventConfig(sheetId),
            ),
            Effect.bind("rangesConfig", ({ sheetId }) =>
              SheetConfigService.getRangesConfig(sheetId),
            ),
            Effect.bind("sheet", ({ sheetId, rangesConfig }) =>
              googleSheets.get({
                spreadsheetId: sheetId,
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
          ),
        listDay: (day: number, serverId: string) =>
          pipe(
            Effect.Do,
            Effect.bind("guildConfig", () =>
              observeEffectSignalOnce(guildConfigService.getConfig(serverId)),
            ),
            Effect.bind("sheetId", ({ guildConfig }) =>
              Option.fromNullable(guildConfig[0].sheetId),
            ),
            Effect.bind("eventConfig", ({ sheetId }) =>
              SheetConfigService.getEventConfig(sheetId),
            ),
            Effect.bind("sheet", ({ sheetId }) =>
              googleSheets.get({
                spreadsheetId: sheetId,
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
          start: number,
          schedules: HashMap.HashMap<number, Schedule>,
        ) => {
          return pipe(
            Effect.Do,
            Effect.let("prevPlayers", () =>
              pipe(
                HashMap.get(schedules, hour - 1),
                Option.getOrElse(() => emptySchedule(hour - 1)),
                ({ players }) => players,
              ),
            ),
            Effect.let("players", () =>
              pipe(
                HashMap.get(schedules, hour),
                Option.getOrElse(() => emptySchedule(hour)),
                ({ players }) => players,
              ),
            ),
            Effect.map(({ prevPlayers, players }) => {
              HashSet.difference(
                HashSet.fromIterable(players),
                HashSet.fromIterable(prevPlayers),
              );
              return `React to this message to check in, and head to <#",'TOYA REBORN'!B$13,"> for ${bold(`hour ${hour}`)} ${time(start + (hour - 1) * 3600, TimestampStyles.RelativeTime)}`;
            }),
          );
        },
      })),
    ),
    dependencies: [GuildConfigService.Default, GoogleSheets.Default],
    accessors: true,
  },
) {}
