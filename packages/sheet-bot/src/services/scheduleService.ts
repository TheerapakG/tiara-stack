import { bold, time, TimestampStyles } from "discord.js";
import { Array, Effect, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { GoogleSheets } from "../google";
import { GuildConfigService } from "./guildConfigService";

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

export class ScheduleService extends Effect.Service<ScheduleService>()(
  "ScheduleService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("guildConfigService", () => GuildConfigService),
      Effect.bind("googleSheets", () => GoogleSheets),
      Effect.map(({ guildConfigService, googleSheets }) => ({
        list: (day: number, serverId: string) =>
          pipe(
            Effect.Do,
            Effect.bind("guildConfigsSubscription", () =>
              guildConfigService.getConfig(serverId),
            ),
            Effect.bind("guildConfigObserver", ({ guildConfigsSubscription }) =>
              observeOnce(guildConfigsSubscription.value),
            ),
            Effect.bind(
              "guildConfig",
              ({ guildConfigObserver }) => guildConfigObserver.value,
            ),
            Effect.bind("sheetId", ({ guildConfig }) =>
              Option.fromNullable(guildConfig[0].sheetId),
            ),
            Effect.bind("sheet", ({ sheetId }) =>
              googleSheets.get({
                spreadsheetId: sheetId,
                ranges: [
                  "'Time + event stuff'!X32",
                  `'Day ${day}'!C3:C`,
                  `'Day ${day}'!J3:O`,
                ],
              }),
            ),
            Effect.let("daySchedule", ({ sheet }) => {
              const [starts, breaks, schedules] = sheet.data.valueRanges ?? [];

              return {
                start: Number(starts.values?.[0][0]),
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
      })),
    ),
    dependencies: [GuildConfigService.Default, GoogleSheets.Default],
    accessors: true,
  },
) {}
