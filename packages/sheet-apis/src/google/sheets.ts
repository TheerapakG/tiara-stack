import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Effect,
  Function,
  HashMap,
  Option,
  ParseResult,
  pipe,
  Schema,
} from "effect";
import { Utils } from "typhoon-core/utils";
import { GoogleAuth } from "./auth";

const parseValueRange = <A, R>(
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
        parseValueRangeToStringOption: (
          valueRange: sheets_v4.Schema$ValueRange,
        ) =>
          pipe(
            parseValueRange(
              valueRange,
              pipe(
                Schema.Array(Schema.OptionFromSelf(Schema.Trim)),
                Schema.head,
              ),
            ),
            Effect.map(Array.map(Option.flatten)),
            Effect.map(Array.map(Option.flatten)),
          ),
        parseValueRangeToNumberOption: (
          valueRange: sheets_v4.Schema$ValueRange,
        ) =>
          pipe(
            parseValueRange(
              valueRange,
              pipe(
                Schema.Array(
                  Schema.OptionFromSelf(
                    pipe(
                      Schema.String,
                      Schema.transform(Schema.String, {
                        strict: true,
                        decode: (str) => str.replaceAll(/[^0-9]/g, ""),
                        encode: Function.identity,
                      }),
                      Schema.compose(Schema.NumberFromString),
                    ),
                  ),
                ),
                Schema.head,
              ),
            ),
            Effect.map(Array.map(Option.flatten)),
            Effect.map(Array.map(Option.flatten)),
          ),
        parseValueRangeToBooleanOption: (
          valueRange: sheets_v4.Schema$ValueRange,
        ) =>
          pipe(
            parseValueRange(
              valueRange,
              pipe(
                Schema.Array(
                  Schema.OptionFromSelf(
                    pipe(
                      Schema.String,
                      Schema.transformOrFail(Schema.Literal("TRUE", "FALSE"), {
                        strict: true,
                        decode: (str) =>
                          ParseResult.decodeUnknown(
                            Schema.Literal("TRUE", "FALSE"),
                          )(str),
                        encode: (str) => ParseResult.succeed(str),
                      }),
                      Schema.compose(
                        Schema.transformLiterals(
                          ["TRUE", true],
                          ["FALSE", false],
                        ),
                      ),
                    ),
                  ),
                ),
                Schema.head,
              ),
            ),
            Effect.map(Array.map(Option.flatten)),
            Effect.map(Array.map(Option.flatten)),
          ),
        parseValueRangeFromStringListToStringArray: (
          valueRange: sheets_v4.Schema$ValueRange,
        ) =>
          pipe(
            parseValueRange(
              valueRange,
              pipe(
                Schema.Array(
                  Schema.OptionFromSelf(
                    pipe(
                      Schema.split(","),
                      Schema.compose(Schema.Array(Schema.Trim)),
                    ),
                  ),
                ),
                Schema.head,
              ),
            ),
            Effect.map(Array.map(Option.flatten)),
            Effect.map(Array.map(Option.flatten)),
            Effect.map(Array.map(Option.getOrElse(() => []))),
          ),
        parseValueRangeFromStringOptionArrayToStringOptionArray: (
          valueRange: sheets_v4.Schema$ValueRange,
        ) =>
          pipe(
            parseValueRange(
              valueRange,
              Schema.Array(Schema.OptionFromSelf(Schema.Trim)),
            ),
            Effect.map(Array.map(Option.getOrElse(() => []))),
          ),
      })),
    ),
    dependencies: [GoogleAuth.Default],
    accessors: true,
  },
) {
  static parseValueRange = parseValueRange;
}
