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
  String,
  Types,
} from "effect";
import {
  OptionArrayToOptionTupleSchema,
  TupleToStructSchema,
} from "typhoon-core/schema";
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

const rangeSchema = Schema.Array(Schema.OptionFromSelf(Schema.String));
const rangeToStructOptionSchema = <const Keys extends ReadonlyArray<string>>(
  keys: Keys,
) =>
  pipe(
    rangeSchema,
    Schema.compose(
      OptionArrayToOptionTupleSchema.OptionArrayToOptionTupleSchema(
        keys.length as Keys["length"],
        Schema.String,
      ) as unknown as Schema.Schema<
        Types.TupleOf<Keys["length"], Option.Option<string>>,
        readonly Option.Option<string>[],
        never
      >,
    ),
    Schema.compose(
      TupleToStructSchema.TupleToStructSchema(
        keys,
        Array.makeBy(keys.length, () =>
          Schema.OptionFromSelf(Schema.String),
        ) as Types.TupleOf<
          Keys["length"],
          Schema.OptionFromSelf<typeof Schema.String>
        >,
      ) as unknown as Schema.Schema<
        { [K in Keys[number]]: Option.Option<string> },
        Types.TupleOf<Keys["length"], Option.Option<string>>,
        never
      >,
    ),
  );

const toStringSchema = Schema.Trim;
const toNumberSchema = pipe(
  Schema.String,
  Schema.transform(Schema.String, {
    strict: true,
    decode: (str) => str.replaceAll(/[^0-9]/g, ""),
    encode: Function.identity,
  }),
  Schema.compose(Schema.NumberFromString),
);
const toBooleanSchema = pipe(
  Schema.String,
  Schema.transformOrFail(Schema.Literal("TRUE", "FALSE"), {
    strict: true,
    decode: (str) =>
      ParseResult.decodeUnknown(Schema.Literal("TRUE", "FALSE"))(str),
    encode: (str) => ParseResult.succeed(str),
  }),
  Schema.compose(Schema.transformLiterals(["TRUE", true], ["FALSE", false])),
);
const toLiteralSchema = <
  const Literals extends Array.NonEmptyReadonlyArray<string>,
>(
  literals: Literals,
) =>
  pipe(
    Schema.String,
    Schema.transformOrFail(Schema.Literal(...literals), {
      strict: true,
      decode: (str) =>
        ParseResult.decodeUnknown(Schema.Literal(...literals))(str),
      encode: (str) => ParseResult.succeed(str),
    }),
  );
const toStringArraySchema = pipe(
  Schema.split(","),
  Schema.compose(Schema.Array(Schema.Trim)),
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
          pipe(
            Effect.tryPromise(() =>
              sheets.spreadsheets.values.batchGet(params, options),
            ),
            Effect.withSpan("GoogleSheets.get", { captureStackTrace: true }),
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
            Effect.withSpan("GoogleSheets.getHashMap", {
              captureStackTrace: true,
            }),
          ),
        update: (
          params?: sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
          options?: MethodOptions,
        ) =>
          pipe(
            Effect.tryPromise(() =>
              sheets.spreadsheets.values.batchUpdate(params, options),
            ),
            Effect.withSpan("GoogleSheets.update", { captureStackTrace: true }),
          ),
        getSheetGids: (sheetId: string) =>
          pipe(
            Effect.tryPromise(() =>
              sheets.spreadsheets.get({ spreadsheetId: sheetId }),
            ),
            Effect.map((sheet) => sheet.data.sheets ?? []),
            Effect.map(
              Array.map(
                (sheet) =>
                  [sheet.properties?.title, sheet.properties?.sheetId] as const,
              ),
            ),
            Effect.map(HashMap.fromIterable),
            Effect.withSpan("GoogleSheets.getSheetGids", {
              captureStackTrace: true,
            }),
          ),
        parseValueRangeToStringOption: (
          valueRange: sheets_v4.Schema$ValueRange,
        ) =>
          pipe(
            parseValueRange(
              valueRange,
              pipe(
                rangeSchema,
                Schema.head,
                Schema.compose(
                  Schema.OptionFromSelf(Schema.OptionFromSelf(toStringSchema)),
                ),
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
                rangeSchema,
                Schema.head,
                Schema.compose(
                  Schema.OptionFromSelf(Schema.OptionFromSelf(toNumberSchema)),
                ),
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
                rangeSchema,
                Schema.head,
                Schema.compose(
                  Schema.OptionFromSelf(Schema.OptionFromSelf(toBooleanSchema)),
                ),
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
                rangeSchema,
                Schema.head,
                Schema.compose(
                  Schema.OptionFromSelf(
                    Schema.OptionFromSelf(toStringArraySchema),
                  ),
                ),
              ),
            ),
            Effect.map(Array.map(Option.flatten)),
            Effect.map(Array.map(Option.flatten)),
            Effect.map(
              Array.map(Option.getOrElse(() => [] as readonly string[])),
            ),
            Effect.map(Array.map(Array.filter(String.isNonEmpty))),
          ),
        parseValueRangeFromStringOptionArrayToStringOptionArray: (
          valueRange: sheets_v4.Schema$ValueRange,
        ) =>
          pipe(
            parseValueRange(valueRange, rangeSchema),
            Effect.map(Array.map(Option.getOrElse(() => []))),
          ),
      })),
    ),
    dependencies: [GoogleAuth.Default],
    accessors: true,
  },
) {
  static parseValueRange = parseValueRange;

  static rangeSchema = rangeSchema;
  static rangeToStructOptionSchema = rangeToStructOptionSchema;
  static toStringSchema = toStringSchema;
  static toNumberSchema = toNumberSchema;
  static toBooleanSchema = toBooleanSchema;
  static toLiteralSchema = toLiteralSchema;
  static toStringArraySchema = toStringArraySchema;

  static parseValueRangeToLiteralOption = <
    const Literals extends Array.NonEmptyReadonlyArray<string>,
  >(
    literals: Literals,
    valueRange: sheets_v4.Schema$ValueRange,
  ) =>
    pipe(
      parseValueRange(
        valueRange,
        pipe(
          Schema.Array(Schema.OptionFromSelf(Schema.String)),
          Schema.head,
          Schema.compose(
            Schema.OptionFromSelf(
              Schema.OptionFromSelf(toLiteralSchema(literals)),
            ),
          ),
        ),
      ),
      Effect.map(Array.map(Option.flatten)),
      Effect.map(Array.map(Option.flatten)),
    );
}
