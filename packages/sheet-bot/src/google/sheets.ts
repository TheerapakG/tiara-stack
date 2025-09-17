import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { Effect, HashMap, pipe } from "effect";
import { Array as ArrayUtils } from "typhoon-core/utils";
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
          defaultKey: K,
          params?: Omit<
            sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
            "ranges"
          >,
          options?: MethodOptions,
        ) =>
          pipe(
            Effect.Do,
            Effect.let("entries", () => HashMap.toEntries(ranges)),
            Effect.bind("sheet", ({ entries }) =>
              Effect.tryPromise(() =>
                sheets.spreadsheets.values.batchGet(
                  { ...params, ranges: entries.map(([_, range]) => range) },
                  options,
                ),
              ),
            ),
            Effect.map(({ entries, sheet }) =>
              pipe(
                new ArrayUtils.WithDefault.ArrayWithDefault({
                  array: entries.map(([key, _]) => ({ key })),
                  default: { key: defaultKey },
                }),
                ArrayUtils.WithDefault.zip(
                  new ArrayUtils.WithDefault.ArrayWithDefault({
                    array:
                      sheet.data.valueRanges?.map((valueRange) => ({
                        valueRange,
                      })) ?? [],
                    default: { valueRange: { values: [] } },
                  }),
                ),
              ),
            ),
            Effect.map(({ array }) =>
              pipe(
                array,
                ArrayUtils.Collect.toHashMap({
                  keyGetter: ({ key }) => key,
                  valueInitializer: ({ valueRange }) => valueRange,
                  valueReducer: (_, { valueRange }) => valueRange,
                }),
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
) {}
