import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { Array, Effect, HashMap, Option, pipe, Schema } from "effect";
import { Utils } from "typhoon-core/utils";
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
        getHashMap: <K>(
          ranges: HashMap.HashMap<K, string>,
          params?: Omit<
            sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
            "ranges"
          >,
          options?: MethodOptions,
        ) =>
          pipe(
            ranges,
            Utils.HashMapPositional((ranges: readonly string[]) =>
              pipe(
                Effect.tryPromise(() =>
                  sheets.spreadsheets.values.batchGet(
                    { ...params, ranges: Array.copy(ranges) },
                    options,
                  ),
                ),
                Effect.map((sheet) => sheet.data.valueRanges ?? []),
              ),
            ),
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
) {
  static parseValueRange = <A, R>(
    valueRange: sheets_v4.Schema$ValueRange,
    rowSchema: Schema.Schema<A, readonly Option.Option<string>[], R>,
  ): Effect.Effect<Option.Option<A>[], never, R> =>
    pipe(
      Option.fromNullable(valueRange.values),
      Option.getOrElse(() => []),
      Effect.forEach((value) =>
        pipe(
          value,
          Schema.decodeUnknown(
            pipe(
              Schema.Array(Schema.OptionFromNonEmptyTrimmedString),
              Schema.compose(rowSchema),
            ),
          ),
          Effect.option,
        ),
      ),
      Effect.withSpan("parseValueRange", { captureStackTrace: true }),
    );
}
