import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import { Array, Effect, Option, pipe } from "effect";
import { observeEffectSignalOnce } from "typhoon-server/signal";
import { GoogleSheets } from "../google/sheets";
import { GuildConfigService } from "./guildConfigService";
import { SheetConfigService } from "./sheetConfigService";

export class SheetService extends Effect.Service<SheetService>()(
  "SheetService",
  {
    effect: (sheetId: string) =>
      pipe(
        Effect.Do,
        Effect.bind("sheet", () => GoogleSheets),
        Effect.bind("sheetConfigService", () => SheetConfigService),
        Effect.bindAll(({ sheetConfigService }) => ({
          rangesConfig: Effect.cached(
            sheetConfigService.getRangesConfig(sheetId),
          ),
          eventConfig: Effect.cached(
            sheetConfigService.getEventConfig(sheetId),
          ),
        })),
        Effect.map(({ sheet, rangesConfig, eventConfig }) => ({
          get: (
            params?: Omit<
              sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
              "spreadsheetId"
            >,
            options?: MethodOptions,
          ) => sheet.get({ spreadsheetId: sheetId, ...params }, options),
          update: (
            params?: Omit<
              sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
              "spreadsheetId"
            >,
            options?: MethodOptions,
          ) => sheet.update({ spreadsheetId: sheetId, ...params }, options),
          getRangesConfig: () => rangesConfig,
          getEventConfig: () => eventConfig,
          getPlayers: () =>
            pipe(
              Effect.Do,
              Effect.bind("rangesConfig", () => rangesConfig),
              Effect.bind("sheet", ({ rangesConfig }) =>
                sheet.get({
                  spreadsheetId: sheetId,
                  ranges: [rangesConfig.userIds, rangesConfig.userSheetNames],
                }),
              ),
              Effect.let("players", ({ sheet }) => {
                const [userIds, userSheetNames] = sheet.data.valueRanges ?? [];
                const userIdObjects = pipe(
                  userIds.values ?? [],
                  Array.map(([userId]) => ({
                    id: String(userId),
                  })),
                );
                const userSheetNameObjects = pipe(
                  userSheetNames.values ?? [],
                  Array.map(([userSheetName]) => ({
                    name: String(userSheetName),
                  })),
                );
                return pipe(
                  userIdObjects,
                  Array.zip(userSheetNameObjects),
                  Array.map(([userId, userSheetName]) => ({
                    ...userId,
                    ...userSheetName,
                  })),
                );
              }),
              Effect.map(({ players }) => players),
            ),
        })),
      ),
    dependencies: [GoogleSheets.Default, SheetConfigService.Default],
    accessors: true,
  },
) {
  static ofGuild(guildId: string) {
    return pipe(
      Effect.Do,
      Effect.bind("guildConfig", () =>
        observeEffectSignalOnce(GuildConfigService.getConfig(guildId)),
      ),
      Effect.bind("sheetId", ({ guildConfig }) =>
        pipe(
          guildConfig,
          Array.head,
          Option.map((guildConfig) => guildConfig.sheetId),
          Option.flatMap(Option.fromNullable),
        ),
      ),
      Effect.map(({ sheetId }) =>
        SheetService.DefaultWithoutDependencies(sheetId),
      ),
    );
  }
}
