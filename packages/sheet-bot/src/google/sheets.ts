import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { Effect, pipe } from "effect";
import { GoogleAuth } from "./auth";

export class GoogleSheets extends Effect.Service<GoogleSheets>()(
  "GoogleSheets",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("auth", () => GoogleAuth),
      Effect.bind("sheets", ({ auth }) =>
        Effect.try(() =>
          sheets({
            version: "v4",
            auth,
          }),
        ),
      ),
      Effect.map(({ sheets }) => ({
        sheets,
        get: (
          params?: sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
          options?: MethodOptions,
        ) =>
          Effect.tryPromise(() =>
            sheets.spreadsheets.values.batchGet(params, options),
          ),
        update: (
          params?: sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
          options?: MethodOptions,
        ) =>
          Effect.tryPromise(() =>
            sheets.spreadsheets.values.batchUpdate(params, options),
          ),
      })),
    ),
    dependencies: [GoogleAuth.Default],
    accessors: true,
  },
) {}
