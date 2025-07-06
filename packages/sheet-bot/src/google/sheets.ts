import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { Effect } from "effect";
import { GoogleAuth } from "./auth";

export class GoogleSheets extends Effect.Service<GoogleSheets>()(
  "GoogleSheets",
  {
    effect: () =>
      GoogleAuth.use((auth) => ({
        sheets: sheets({
          version: "v4",
          auth,
        }),
      })),
    dependencies: [GoogleAuth.Default],
  },
) {
  static get(
    params?: sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
    options?: MethodOptions,
  ) {
    return GoogleSheets.use(({ sheets }) =>
      Effect.tryPromise(() =>
        sheets.spreadsheets.values.batchGet(params, options),
      ),
    );
  }

  static update(
    params?: sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
    options?: MethodOptions,
  ) {
    return GoogleSheets.use(({ sheets }) =>
      Effect.tryPromise(() =>
        sheets.spreadsheets.values.batchUpdate(params, options),
      ),
    );
  }
}
