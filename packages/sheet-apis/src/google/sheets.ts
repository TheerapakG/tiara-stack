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
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";
import { GoogleAuthService } from "./auth";

const parseValueRanges = <
  Ranges extends Array.NonEmptyReadonlyArray<sheets_v4.Schema$ValueRange>,
  A,
  R,
  Length extends Ranges["length"] = Ranges["length"],
>(
  valueRanges: Ranges,
  rowSchemas: Schema.Schema<
    A,
    Readonly<Types.TupleOf<Length, readonly Option.Option<string>[]>>,
    R
  >,
): Effect.Effect<Either.Either<A, ParseResult.ParseError>[], never, R> => {
  const rowSchema = Schema.Array(Schema.OptionFromNonEmptyTrimmedString);
  const rowTupleSchema = Schema.Tuple(
    ...(Array.makeBy(valueRanges.length, () => rowSchema) as Types.TupleOf<
      Length,
      typeof rowSchema
    >),
  ) as unknown as Schema.Schema<
    Types.TupleOf<Length, readonly Option.Option<string>[]>,
    Types.TupleOf<Length, readonly string[]>,
    never
  >;
  const decodeSchema = pipe(
    rowTupleSchema,
    Schema.compose(rowSchemas),
  ) as Schema.Schema<A, Types.TupleOf<Length, readonly string[]>, R>;

  return pipe(
    valueRanges,
    Array.map(({ values }) => values),
    Array.map(Option.fromNullable),
    Array.map(Option.getOrElse(() => [])),
    Array.map(ArrayUtils.WithDefault.wrap<any[][]>({ default: () => [] })),
    Array.map(ArrayUtils.WithDefault.map((row) => [row])),
    (ranges) =>
      Array.reduce(
        Array.tailNonEmpty(ranges),
        Array.headNonEmpty(ranges),
        (acc, curr) => pipe(acc, ArrayUtils.WithDefault.zipArray(curr)),
      ),
    ArrayUtils.WithDefault.toArray,
    Effect.forEach(
      (rows) => pipe(rows, Schema.decodeUnknown(decodeSchema), Effect.either),
      { concurrency: "unbounded" },
    ),
    Effect.withSpan("parseValueRanges", { captureStackTrace: true }),
  );
};

const tupleSchema = <const Length extends number, S extends Schema.Schema.Any>(
  length: Length,
  schema: S,
) =>
  Schema.Tuple(
    ...(Array.makeBy(length, () => schema) as Types.TupleOf<Length, S>),
  );

const cellSchema = Schema.OptionFromSelf(Schema.String);
const rowSchema = Schema.Array(cellSchema);

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
      Effect.bind("auth", () => GoogleAuthService.getAuth()),
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
            Utils.hashMapPositional((ranges: readonly string[]) =>
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
    dependencies: [GoogleAuthService.Default],
    accessors: true,
  },
) {
  static parseValueRanges = parseValueRanges;

  static tupleSchema = tupleSchema;
  static cellSchema = cellSchema;
  static rowSchema = rowSchema;
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
