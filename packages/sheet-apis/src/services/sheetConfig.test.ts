import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { GoogleSheets } from "./google/sheets";
import { SheetConfigService } from "./sheetConfig";

type GoogleSheetsApi = Effect.Success<typeof GoogleSheets.make>;

const makeGoogleSheets = () =>
  ({
    get: () =>
      Effect.succeed({
        data: {
          valueRanges: [
            {
              values: [
                [
                  "main",
                  "1",
                  "Schedule",
                  "A1:A1",
                  "B1:B1",
                  null,
                  "bold",
                  "C1:G1",
                  "H1:H1",
                  "I1:I1",
                  null,
                  null,
                  "J1:J1",
                  null,
                ],
              ],
            },
          ],
        },
      }),
  }) as unknown as GoogleSheetsApi;

describe("SheetConfigService", () => {
  it.effect("accepts bold as a schedule encType", () =>
    Effect.gen(function* () {
      const sheetConfigService = yield* SheetConfigService.make;
      const [config] = yield* sheetConfigService.getScheduleConfig("sheet-1");

      expect(config).toBeDefined();
      expect(config?.encType).toEqual(Option.some("bold"));
    }).pipe(Effect.provideService(GoogleSheets, makeGoogleSheets())),
  );
});
