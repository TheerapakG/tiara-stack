import { MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { Error } from "@/server/schema";
import { regex, Regex } from "arkregex";
import type { RegexExecArray } from "arkregex/internal/execArray.ts";
import type { RegexContext } from "arkregex/internal/regex.ts";
import {
  Array,
  Effect,
  Either,
  flow,
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

const parseRowDatas = <
  Ranges extends Array.NonEmptyReadonlyArray<sheets_v4.Schema$RowData[]>,
  A,
  R,
  Length extends Ranges["length"] = Ranges["length"],
>(
  rowDatas: Ranges,
  rowSchemas: Schema.Schema<
    A,
    Readonly<Types.TupleOf<Length, readonly Schema.Schema.Type<typeof rowDataCellSchema>[]>>,
    R
  >,
): Effect.Effect<Either.Either<A, ParseResult.ParseError>[], never, R> => {
  const rowSchema = Schema.Array(rowDataCellSchema);
  const rowTupleSchema = Schema.Tuple(
    ...(Array.makeBy(rowDatas.length, () => rowSchema) as Types.TupleOf<Length, typeof rowSchema>),
  ) as unknown as Schema.Schema<
    Types.TupleOf<Length, readonly Schema.Schema.Type<typeof rowDataCellSchema>[]>,
    Types.TupleOf<Length, readonly Schema.Schema.Encoded<typeof rowDataCellSchema>[]>,
    never
  >;
  const decodeSchema = pipe(rowTupleSchema, Schema.compose(rowSchemas)) as Schema.Schema<
    A,
    Types.TupleOf<Length, readonly Schema.Schema.Encoded<typeof rowDataCellSchema>[]>,
    R
  >;

  return pipe(
    rowDatas as Array.NonEmptyReadonlyArray<sheets_v4.Schema$RowData[]>,
    Array.map(Array.map(({ values }) => values)),
    Array.map(Array.map(Option.fromNullable)),
    Array.map(Array.map(Option.getOrElse(() => []))),
    Array.map(ArrayUtils.WithDefault.wrap<sheets_v4.Schema$CellData[][]>({ default: () => [] })),
    Array.map(ArrayUtils.WithDefault.map((row) => [row])),
    (ranges) =>
      Array.reduce(Array.tailNonEmpty(ranges), Array.headNonEmpty(ranges), (acc, curr) =>
        pipe(acc, ArrayUtils.WithDefault.zipArray(curr)),
      ),
    ArrayUtils.WithDefault.toArray,
    Effect.forEach((rows) => pipe(rows, Schema.decodeUnknown(decodeSchema), Effect.either), {
      concurrency: "unbounded",
    }),
    Effect.withSpan("parseRowDatas", { captureStackTrace: true }),
  );
};

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
  const decodeSchema = pipe(rowTupleSchema, Schema.compose(rowSchemas)) as Schema.Schema<
    A,
    Types.TupleOf<Length, readonly string[]>,
    R
  >;

  return pipe(
    valueRanges,
    Array.map(({ values }) => values),
    Array.map(Option.fromNullable),
    Array.map(Option.getOrElse(() => [])),
    Array.map(ArrayUtils.WithDefault.wrap<any[][]>({ default: () => [] })),
    Array.map(ArrayUtils.WithDefault.map((row) => [row])),
    (ranges) =>
      Array.reduce(Array.tailNonEmpty(ranges), Array.headNonEmpty(ranges), (acc, curr) =>
        pipe(acc, ArrayUtils.WithDefault.zipArray(curr)),
      ),
    ArrayUtils.WithDefault.toArray,
    Effect.forEach((rows) => pipe(rows, Schema.decodeUnknown(decodeSchema), Effect.either), {
      concurrency: "unbounded",
    }),
    Effect.withSpan("parseValueRanges", { captureStackTrace: true }),
  );
};

const tupleSchema = <const Length extends number, S extends Schema.Schema.Any>(
  length: Length,
  schema: S,
) => Schema.Tuple(...(Array.makeBy(length, () => schema) as Types.TupleOf<Length, S>));

const dataExecutionStatusSchema = Schema.Struct({
  errorCode: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  errorMessage: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  lastRefreshTime: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  state: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
});

const extendedValueSchema = Schema.Struct({
  boolValue: Schema.optionalWith(Schema.Boolean, { nullable: true, as: "Option" }),
  errorValue: Schema.optionalWith(Schema.Any, { as: "Option" }),
  formulaValue: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  numberValue: Schema.optionalWith(Schema.Number, { nullable: true, as: "Option" }),
  stringValue: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
});

const dataSourceFormulaSchema = Schema.Struct({
  dataExecutionStatus: Schema.optionalWith(dataExecutionStatusSchema, { as: "Option" }),
  dataSourceId: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
});

const dataSourceTableSchema = Schema.Struct({
  columns: Schema.optionalWith(Schema.Array(Schema.Any), { as: "Option" }),
  columnSelectionType: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  dataExecutionStatus: Schema.optionalWith(dataExecutionStatusSchema, { as: "Option" }),
  dataSourceId: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  filterSpecs: Schema.optionalWith(Schema.Array(Schema.Any), { as: "Option" }),
  rowLimit: Schema.optionalWith(Schema.Number, { nullable: true, as: "Option" }),
  sortSpecs: Schema.optionalWith(Schema.Array(Schema.Any), { as: "Option" }),
});

const rowDataCellSchema = Schema.Struct({
  dataSourceFormula: Schema.optionalWith(dataSourceFormulaSchema, { as: "Option" }),
  dataSourceTable: Schema.optionalWith(dataSourceTableSchema, { as: "Option" }),
  dataValidation: Schema.optionalWith(Schema.Any, { as: "Option" }),
  effectiveFormat: Schema.optionalWith(Schema.Any, { as: "Option" }),
  effectiveValue: Schema.optionalWith(extendedValueSchema, { as: "Option" }),
  formattedValue: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  hyperlink: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  note: Schema.optionalWith(Schema.String, { nullable: true, as: "Option" }),
  pivotTable: Schema.optionalWith(Schema.Any, { as: "Option" }),
  textFormatRuns: Schema.optionalWith(Schema.Array(Schema.Any), { as: "Option" }),
  userEnteredFormat: Schema.optionalWith(Schema.Any, { as: "Option" }),
  userEnteredValue: Schema.optionalWith(extendedValueSchema, { as: "Option" }),
});
const rowDataSchema = Schema.Array(rowDataCellSchema);
const cellSchema = Schema.OptionFromSelf(Schema.String);
const rowSchema = Schema.Array(cellSchema);

const rowDataCellToCellSchema = pipe(
  Schema.typeSchema(rowDataCellSchema),
  Schema.transformOrFail(cellSchema, {
    strict: true,
    decode: (rowDataCell) => ParseResult.succeed(rowDataCell.formattedValue),
    encode: (output, _, ast) =>
      ParseResult.fail(
        new ParseResult.Forbidden(ast, output, "Row data cell cannot be encoded to cell"),
      ),
  }),
);
const rowDataToRowSchema = Schema.Array(rowDataCellToCellSchema);
const rowToCellSchema = pipe(
  rowSchema,
  Schema.head,
  Schema.transform(cellSchema, {
    strict: true,
    decode: Option.flatten,
    encode: Option.some,
  }),
);
const rowDataToCellSchema = pipe(
  Schema.Array(rowDataCellToCellSchema),
  Schema.compose(rowToCellSchema),
);

const matchAll =
  <Pattern extends string, Context extends RegexContext>(regex: Regex<Pattern, Context>) =>
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
    decode: flow(
      matchAll(regex("\\d+(?:\\.\\d+)?", "g")),
      Array.head,
      Option.map((match) => match[0]),
      Option.getOrElse(() => ""),
    ),
    encode: Function.identity,
  }),
  Schema.compose(Schema.NumberFromString),
);
const toBooleanSchema = pipe(
  Schema.String,
  Schema.transformOrFail(Schema.Literal("TRUE", "FALSE"), {
    strict: true,
    decode: (str) => ParseResult.decodeUnknown(Schema.Literal("TRUE", "FALSE"))(str),
    encode: (str) => ParseResult.succeed(str),
  }),
  Schema.compose(Schema.transformLiterals(["TRUE", true], ["FALSE", false])),
);
const toLiteralSchema = <const Literals extends Array.NonEmptyReadonlyArray<string>>(
  literals: Literals,
) =>
  pipe(
    Schema.String,
    Schema.transformOrFail(Schema.Literal(...literals), {
      strict: true,
      decode: (str) => ParseResult.decodeUnknown(Schema.Literal(...literals))(str),
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

export class GoogleSheets extends Effect.Service<GoogleSheets>()("GoogleSheets", {
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
      getSheetRowDatas: (
        params?: sheets_v4.Params$Resource$Spreadsheets$Get,
        options?: MethodOptions,
      ) =>
        pipe(
          Effect.tryPromise({
            try: () => sheets.spreadsheets.get(params, options),
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
          Effect.map((sheet) =>
            pipe(
              sheet.data.sheets ?? [],
              Array.flatMap((sheet) => sheet.data ?? []),
              Array.map((gridData) => gridData.rowData ?? []),
            ),
          ),
          Effect.withSpan("GoogleSheets.get", { captureStackTrace: true }),
        ),
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
        params?: Omit<sheets_v4.Params$Resource$Spreadsheets$Values$Batchget, "ranges">,
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
              Effect.map((sheet) => sheet.data.valueRanges ?? []),
            ),
          ),
          Effect.withSpan("GoogleSheets.getHashMap", {
            captureStackTrace: true,
          }),
        ),
      getRowDatasHashMap: <K>(
        ranges: HashMap.HashMap<K, string>,
        params?: Omit<sheets_v4.Params$Resource$Spreadsheets$Get, "ranges">,
        options?: MethodOptions,
      ): Effect.Effect<HashMap.HashMap<K, sheets_v4.Schema$RowData[]>, Error.GoogleSheetsError> =>
        pipe(
          ranges,
          Utils.hashMapPositional((ranges: readonly string[]) =>
            pipe(
              Effect.tryPromise({
                try: () =>
                  sheets.spreadsheets.get(
                    {
                      ...params,
                      ranges: Array.copy(ranges),
                      includeGridData: true,
                    },
                    options,
                  ),
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
              Effect.map((sheet) =>
                pipe(
                  sheet.data.sheets ?? [],
                  Array.flatMap((sheet) => sheet.data ?? []),
                  Array.map((gridData) => gridData.rowData ?? []),
                  ArrayUtils.WithDefault.wrap<sheets_v4.Schema$RowData[][]>({
                    default: () => [],
                  }),
                  ArrayUtils.WithDefault.toArray,
                ),
              ),
            ),
          ),
          Effect.withSpan("GoogleSheets.getRowDatasHashMap", {
            captureStackTrace: true,
          }),
        ),
      update: (
        params?: sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
        options?: MethodOptions,
      ) =>
        pipe(
          Effect.tryPromise({
            try: () => sheets.spreadsheets.values.batchUpdate(params, options),
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
          Effect.map(HashMap.map(({ sheetId }) => Option.fromNullable(sheetId))),
          Effect.withSpan("GoogleSheets.getSheetGids", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [GoogleAuthService.Default],
  accessors: true,
}) {
  static parseRowDatas = parseRowDatas;
  static parseValueRanges = parseValueRanges;

  static tupleSchema = tupleSchema;
  static rowToCellSchema = rowToCellSchema;
  static cellSchema = cellSchema;
  static rowDataSchema = rowDataSchema;
  static rowSchema = rowSchema;
  static rowDataCellToCellSchema = rowDataCellToCellSchema;
  static rowDataToRowSchema = rowDataToRowSchema;
  static rowDataToCellSchema = rowDataToCellSchema;
  static toStringSchema = toStringSchema;
  static cellToStringSchema = Schema.OptionFromSelf(toStringSchema);
  static toNumberSchema = toNumberSchema;
  static cellToNumberSchema = Schema.OptionFromSelf(toNumberSchema);
  static toBooleanSchema = toBooleanSchema;
  static cellToBooleanSchema = Schema.OptionFromSelf(toBooleanSchema);
  static toLiteralSchema = toLiteralSchema;
  static cellToLiteralSchema = <const Literals extends Array.NonEmptyReadonlyArray<string>>(
    literals: Literals,
  ) => Schema.OptionFromSelf(toLiteralSchema(literals));
  static toStringArraySchema = toStringArraySchema;
  static cellToStringArraySchema = Schema.OptionFromSelf(toStringArraySchema);
}
