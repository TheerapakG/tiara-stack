import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { Error } from "@/server/schema";
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
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";
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

const cellSchema = Schema.OptionFromSelf(Schema.String);
const rangeSchema = Schema.Array(cellSchema);
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
        Array.makeBy(keys.length, () => cellSchema) as Types.TupleOf<
          Keys["length"],
          typeof cellSchema
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
            Effect.tryPromise({
              try: () => sheets.spreadsheets.values.batchGet(params, options),
              catch: Function.identity,
            }),
            Effect.catchAll((error) =>
              pipe(
                error,
                Schema.decodeUnknown(Schema.Struct({ message: Schema.String })),
                Effect.option,
                Effect.flatMap((message) =>
                  Effect.fail(
                    new Error.GoogleSheetsError({
                      message: pipe(
                        message,
                        Option.map((message) => message.message),
                        Option.getOrElse(() => "An unknown error occurred"),
                      ),
                      cause: error,
                    }),
                  ),
                ),
              ),
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
                Effect.tryPromise({
                  try: () =>
                    sheets.spreadsheets.values.batchGet(
                      { ...params, ranges: Array.copy(ranges) },
                      options,
                    ),
                  catch: Function.identity,
                }),
                Effect.catchAll((error) =>
                  pipe(
                    error,
                    Schema.decodeUnknown(
                      Schema.Struct({ message: Schema.String }),
                    ),
                    Effect.option,
                    Effect.flatMap((message) =>
                      Effect.fail(
                        new Error.GoogleSheetsError({
                          message: pipe(
                            message,
                            Option.map((message) => message.message),
                            Option.getOrElse(() => "An unknown error occurred"),
                          ),
                          cause: error,
                        }),
                      ),
                    ),
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
            Effect.tryPromise({
              try: () =>
                sheets.spreadsheets.values.batchUpdate(params, options),
              catch: Function.identity,
            }),
            Effect.catchAll((error) =>
              pipe(
                error,
                Schema.decodeUnknown(Schema.Struct({ message: Schema.String })),
                Effect.option,
                Effect.flatMap((message) =>
                  Effect.fail(
                    new Error.GoogleSheetsError({
                      message: pipe(
                        message,
                        Option.map((message) => message.message),
                        Option.getOrElse(() => "An unknown error occurred"),
                      ),
                      cause: error,
                    }),
                  ),
                ),
              ),
            ),
            Effect.withSpan("GoogleSheets.update", { captureStackTrace: true }),
          ),
        getSheetGids: (sheetId: string) =>
          pipe(
            Effect.tryPromise({
              try: () => sheets.spreadsheets.get({ spreadsheetId: sheetId }),
              catch: Function.identity,
            }),
            Effect.catchAll((error) =>
              pipe(
                error,
                Schema.decodeUnknown(Schema.Struct({ message: Schema.String })),
                Effect.option,
                Effect.flatMap((message) =>
                  Effect.fail(
                    new Error.GoogleSheetsError({
                      message: pipe(
                        message,
                        Option.map((message) => message.message),
                        Option.getOrElse(() => "An unknown error occurred"),
                      ),
                      cause: error,
                    }),
                  ),
                ),
              ),
            ),
            Effect.map((sheet) => sheet.data.sheets ?? []),
            Effect.map(Array.map((sheet) => sheet.properties)),
            Effect.map(Array.map(Option.fromNullable)),
            Effect.map(Array.getSomes),
            Effect.map(ArrayUtils.Collect.toHashMapByKey("title")),
            Effect.map(HashMap.map(({ sheetId }) => sheetId)),
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

  static cellSchema = cellSchema;
  static rangeSchema = rangeSchema;
  static rangeToStructOptionSchema = rangeToStructOptionSchema;
  static toStringSchema = toStringSchema;
  static cellToStringSchema = Schema.OptionFromSelf(toStringSchema);
  static toNumberSchema = toNumberSchema;
  static cellToNumberSchema = Schema.OptionFromSelf(toNumberSchema);
  static toBooleanSchema = toBooleanSchema;
  static cellToBooleanSchema = Schema.OptionFromSelf(toBooleanSchema);
  static toLiteralSchema = toLiteralSchema;
  static cellToLiteralSchema = <
    const Literals extends Array.NonEmptyReadonlyArray<string>,
  >(
    literals: Literals,
  ) => Schema.OptionFromSelf(toLiteralSchema(literals));
  static toStringArraySchema = toStringArraySchema;
  static cellToStringArraySchema = Schema.OptionFromSelf(toStringArraySchema);

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
