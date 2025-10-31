import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { Error } from "@/server/schema";
import { regex, Regex } from "arkregex";
import type { RegexExecArray } from "arkregex/internal/execArray.ts";
import type { RegexContext } from "arkregex/internal/regex.ts";
import {
  Array,
  Effect,
  Either,
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
): Effect.Effect<Either.Either<A, ParseResult.ParseError>[], never, R> =>
  pipe(
    Option.fromNullable(valueRange.values),
    Option.getOrElse(() => []),
    Effect.forEach(
      (row) =>
        pipe(
          row,
          Schema.decodeUnknown(
            pipe(
              Schema.Array(Schema.OptionFromNonEmptyTrimmedString),
              Schema.compose(rowSchema),
            ),
          ),
          Effect.either,
        ),
      { concurrency: "unbounded" },
    ),
    Effect.withSpan("parseValueRange", { captureStackTrace: true }),
  );

const parseValueRanges = <A, R>(
  valueRanges: sheets_v4.Schema$ValueRange[],
  rowSchemas: Schema.Schema<
    A,
    readonly (readonly Option.Option<string>[])[],
    R
  >,
): Effect.Effect<Either.Either<A, ParseResult.ParseError>[], never, R> =>
  pipe(
    valueRanges,
    Array.map(({ values }) => values),
    Array.map(Option.fromNullable),
    Array.map(Option.getOrElse(() => [])),
    Array.map(ArrayUtils.WithDefault.wrap({ default: () => [] })),
    Array.map(ArrayUtils.WithDefault.map((row) => [row])),
    Array.match({
      onEmpty: () =>
        pipe([], ArrayUtils.WithDefault.wrap<never[][]>({ default: () => [] })),
      onNonEmpty: (ranges) =>
        Array.reduce(
          Array.tailNonEmpty(ranges),
          Array.headNonEmpty(ranges),
          (acc, curr) => pipe(acc, ArrayUtils.WithDefault.zipArray(curr)),
        ),
    }),
    ArrayUtils.WithDefault.toArray,
    Effect.forEach(
      (rows) =>
        pipe(
          rows,
          Schema.decodeUnknown(
            pipe(
              Schema.Array(
                Schema.Array(Schema.OptionFromNonEmptyTrimmedString),
              ),
              Schema.compose(rowSchemas),
            ),
          ),
          Effect.either,
        ),
      { concurrency: "unbounded" },
    ),
    Effect.withSpan("parseValueRanges", { captureStackTrace: true }),
  );

const cellSchema = Schema.OptionFromSelf(Schema.String);
const rowSchema = Schema.Array(cellSchema);
const rowToCellStructSchema = <const Keys extends ReadonlyArray<string>>(
  keys: Keys,
) =>
  pipe(
    rowSchema,
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
const rowToCellSchema = pipe(
  rowSchema,
  Schema.head,
  Schema.transform(cellSchema, {
    strict: true,
    decode: Option.flatten,
    encode: Option.some,
  }),
);

const matchAll =
  <Pattern extends string, Context extends RegexContext>(
    regex: Regex<Pattern, Context>,
  ) =>
  (str: string) => {
    const matches: RegexExecArray<
      [Pattern, ...(typeof regex)["inferCaptures"]],
      (typeof regex)["inferNamedCaptures"],
      (typeof regex)["flags"]
    >[] = [];
    while (true) {
      const match = regex.exec(str);
      if (!match) break;
      matches.push(match);
    }
    return matches;
  };

const toStringSchema = Schema.Trim;
const toNumberSchema = pipe(
  Schema.String,
  Schema.transform(Schema.String, {
    strict: true,
    decode: (str) =>
      pipe(
        str,
        matchAll(regex("\\d+", "g")),
        Array.map((match) => match[0]),
        Array.join(""),
      ),
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
  Schema.transform(Schema.Array(Schema.String), {
    strict: true,
    decode: Array.filter(String.isNonEmpty),
    encode: Function.identity,
  }),
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
      })),
    ),
    dependencies: [GoogleAuth.Default],
    accessors: true,
  },
) {
  static parseValueRange = parseValueRange;
  static parseValueRanges = parseValueRanges;

  static cellSchema = cellSchema;
  static rowSchema = rowSchema;
  static rowToCellStructSchema = rowToCellStructSchema;
  static rowToCellSchema = rowToCellSchema;
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
}
