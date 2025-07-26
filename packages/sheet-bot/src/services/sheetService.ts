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
          ) =>
            pipe(
              sheet.get({ spreadsheetId: sheetId, ...params }, options),
              Effect.withSpan("SheetService.get", { captureStackTrace: true }),
            ),
          update: (
            params?: Omit<
              sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
              "spreadsheetId"
            >,
            options?: MethodOptions,
          ) =>
            pipe(
              sheet.update({ spreadsheetId: sheetId, ...params }, options),
              Effect.withSpan("SheetService.update", {
                captureStackTrace: true,
              }),
            ),
          getRangesConfig: () =>
            pipe(rangesConfig, Effect.withSpan("SheetService.getRangesConfig")),
          getEventConfig: () =>
            pipe(eventConfig, Effect.withSpan("SheetService.getEventConfig")),
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
                    id:
                      userId === undefined
                        ? Option.none()
                        : Option.some(String(userId)),
                  })),
                );
                const userSheetNameObjects = pipe(
                  userSheetNames.values ?? [],
                  Array.map(([userSheetName]) => ({
                    name:
                      userSheetName === undefined
                        ? Option.none()
                        : Option.some(String(userSheetName)),
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
              Effect.withSpan("SheetService.getPlayers", {
                captureStackTrace: true,
              }),
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
      Effect.withSpan("SheetService.ofGuild", { captureStackTrace: true }),
    );
  }
}
