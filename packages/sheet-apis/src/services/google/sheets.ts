import { type MethodOptions, sheets, sheets_v4 } from "@googleapis/sheets";
import { regex, type Regex } from "arkregex";
import type { RegexExecArray } from "arkregex/internal/execArray.ts";
import type { RegexContext } from "arkregex/internal/regex.ts";
import {
  Array,
  Effect,
  Function,
  HashMap,
  Layer,
  Option,
  pipe,
  Result,
  Schema,
  SchemaGetter,
  SchemaIssue,
  ServiceMap,
  String,
  Types,
} from "effect";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";

import { GoogleSheetsError } from "@/schemas/google";
import { GoogleAuthService } from "./auth";

const tupleSchema = <Length extends number, S extends Schema.Top>(length: Length, schema: S) =>
  Schema.Tuple(Array.makeBy(length, () => schema) as Types.TupleOf<Length, S>);

const parseRowDatas = <
  Ranges extends Array.NonEmptyReadonlyArray<sheets_v4.Schema$RowData[]>,
  A,
  S extends Schema.Codec<
    A,
    Readonly<Types.TupleOf<Length, Schema.Schema.Type<typeof rowDataSchema>>>
  >,
  Length extends Ranges["length"] = Ranges["length"],
>(
  rowDatas: Ranges,
  rowSchemas: S,
) => {
  const rowTupleSchema = tupleSchema(
    rowDatas.length as Length,
    rowDataSchema,
  ) as unknown as Schema.Decoder<
    Readonly<Types.TupleOf<Length, Schema.Schema.Type<typeof rowDataSchema>>>
  >;
  const rows = pipe(
    rowDatas,
    Array.map((rows) => Array.map(rows, (row) => row.values ?? [])),
    Array.map(ArrayUtils.WithDefault.wrap<sheets_v4.Schema$CellData[][]>({ default: () => [] })),
    Array.map(ArrayUtils.WithDefault.map((row) => [row])),
    (ranges) =>
      Array.reduce(Array.tailNonEmpty(ranges), Array.headNonEmpty(ranges), (acc, curr) =>
        pipe(acc, ArrayUtils.WithDefault.zipArray(curr)),
      ),
    ArrayUtils.WithDefault.toArray,
  );

  return Effect.forEach(
    rows,
    (rows) =>
      Effect.succeed(
        pipe(
          rows,
          Schema.decodeUnknownResult(rowTupleSchema),
          Result.flatMap(Schema.decodeResult(rowSchemas)),
        ),
      ),
    { concurrency: "unbounded" },
  ).pipe(Effect.withSpan("parseRowDatas"));
};

const parseValueRanges = <
  Ranges extends Array.NonEmptyReadonlyArray<sheets_v4.Schema$ValueRange>,
  A,
  S extends Schema.Codec<A, Readonly<Types.TupleOf<Length, readonly Option.Option<string>[]>>>,
  Length extends Ranges["length"] = Ranges["length"],
>(
  valueRanges: Ranges,
  rowSchemas: S,
) => {
  const rowTupleSchema = tupleSchema(valueRanges.length, rowSchema) as unknown as Schema.Decoder<
    Readonly<Types.TupleOf<Length, readonly Option.Option<string>[]>>
  >;
  const rows = pipe(
    valueRanges,
    Array.map(({ values }) => values ?? []),
    Array.map(
      ArrayUtils.WithDefault.wrap<unknown[][]>({
        default: () => [],
      }),
    ),
    Array.map(
      ArrayUtils.WithDefault.map((row) =>
        Array.map(row, (cell) =>
          typeof cell === "string" ? Option.some(cell) : Option.fromNullishOr(cell?.toString()),
        ),
      ),
    ),
    Array.map(ArrayUtils.WithDefault.map((row) => [row])),
    (ranges) =>
      Array.reduce(Array.tailNonEmpty(ranges), Array.headNonEmpty(ranges), (acc, curr) =>
        pipe(acc, ArrayUtils.WithDefault.zipArray(curr)),
      ),
    ArrayUtils.WithDefault.toArray,
  );

  return Effect.forEach(
    rows,
    (rows) =>
      Effect.succeed(
        pipe(
          rows,
          Schema.decodeUnknownResult(rowTupleSchema),
          Result.flatMap(Schema.decodeResult(rowSchemas)),
        ),
      ),
    { concurrency: "unbounded" },
  ).pipe(Effect.withSpan("parseValueRanges"));
};

const dataExecutionStatusSchema = Schema.Struct({
  errorCode: Schema.OptionFromNullishOr(Schema.String),
  errorMessage: Schema.OptionFromNullishOr(Schema.String),
  lastRefreshTime: Schema.OptionFromNullishOr(Schema.String),
  state: Schema.OptionFromNullishOr(Schema.String),
});

const extendedValueSchema = Schema.Struct({
  boolValue: Schema.OptionFromNullishOr(Schema.Boolean),
  errorValue: Schema.OptionFromNullishOr(Schema.Any),
  formulaValue: Schema.OptionFromNullishOr(Schema.String),
  numberValue: Schema.OptionFromNullishOr(Schema.Number),
  stringValue: Schema.OptionFromNullishOr(Schema.String),
});

const dataSourceFormulaSchema = Schema.Struct({
  dataExecutionStatus: Schema.OptionFromNullishOr(dataExecutionStatusSchema),
  dataSourceId: Schema.OptionFromNullishOr(Schema.String),
});

const dataSourceTableSchema = Schema.Struct({
  columns: Schema.OptionFromNullishOr(Schema.Array(Schema.Any)),
  columnSelectionType: Schema.OptionFromNullishOr(Schema.String),
  dataExecutionStatus: Schema.OptionFromNullishOr(dataExecutionStatusSchema),
  dataSourceId: Schema.OptionFromNullishOr(Schema.String),
  filterSpecs: Schema.OptionFromNullishOr(Schema.Array(Schema.Any)),
  rowLimit: Schema.OptionFromNullishOr(Schema.Number),
  sortSpecs: Schema.OptionFromNullishOr(Schema.Array(Schema.Any)),
});

const rowDataCellSchema = Schema.Struct({
  dataSourceFormula: Schema.OptionFromNullishOr(dataSourceFormulaSchema),
  dataSourceTable: Schema.OptionFromNullishOr(dataSourceTableSchema),
  dataValidation: Schema.OptionFromNullishOr(Schema.Any),
  effectiveFormat: Schema.OptionFromNullishOr(Schema.Any),
  effectiveValue: Schema.OptionFromNullishOr(extendedValueSchema),
  formattedValue: Schema.OptionFromNullishOr(Schema.String),
  hyperlink: Schema.OptionFromNullishOr(Schema.String),
  note: Schema.OptionFromNullishOr(Schema.String),
  pivotTable: Schema.OptionFromNullishOr(Schema.Any),
  textFormatRuns: Schema.OptionFromNullishOr(Schema.Array(Schema.Any)),
  userEnteredFormat: Schema.OptionFromNullishOr(Schema.Any),
  userEnteredValue: Schema.OptionFromNullishOr(extendedValueSchema),
});
const rowDataSchema = Schema.Array(rowDataCellSchema);
const cellSchema = Schema.Option(Schema.String);
const rowSchema = Schema.Array(cellSchema);

const rowDataCellToCellSchema = Schema.toType(rowDataCellSchema).pipe(
  Schema.decodeTo(cellSchema, {
    decode: SchemaGetter.transform((rowDataCell) => rowDataCell.formattedValue),
    encode: SchemaGetter.forbidden(() => "Row data cell cannot be encoded to cell"),
  }),
);
const rowDataToRowSchema = Schema.Array(rowDataCellToCellSchema);
const rowToCellSchema = rowSchema.pipe(
  Schema.decodeTo(cellSchema, {
    decode: SchemaGetter.transform((row) =>
      pipe(
        row,
        Array.get(0),
        Option.getOrElse(() => Option.none<string>()),
      ),
    ),
    encode: SchemaGetter.transform((cell) => [cell]),
  }),
);
const rowDataToCellSchema = rowDataToRowSchema.pipe(Schema.decodeTo(rowToCellSchema));

const matchAll =
  <Pattern extends string, Context extends RegexContext>(value: Regex<Pattern, Context>) =>
  (str: string) => {
    const matches: RegexExecArray<
      [Pattern, ...(typeof value)["inferCaptures"]],
      (typeof value)["inferNamedCaptures"],
      (typeof value)["flags"]
    >[] = [];
    while (true) {
      const match = value.exec(str);
      if (!match) break;
      matches.push(match);
    }
    return matches;
  };

const toStringSchema = Schema.Trim;
const toNumberSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transformOrFail((value) => {
      const numeric = pipe(
        value,
        matchAll(regex("\\d+(?:\\.\\d+)?", "g")),
        Array.head,
        Option.map((match) => match[0]),
        Option.flatMap((match) =>
          Number.isNaN(Number.parseFloat(match))
            ? Option.none()
            : Option.some(Number.parseFloat(match)),
        ),
      );

      return pipe(
        numeric,
        Option.match({
          onSome: Effect.succeed,
          onNone: () => Effect.fail(new SchemaIssue.InvalidValue(Option.some(value))),
        }),
      );
    }),
    encode: SchemaGetter.String(),
  }),
);
const toBooleanSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transformOrFail((value) =>
      value === "TRUE"
        ? Effect.succeed(true)
        : value === "FALSE"
          ? Effect.succeed(false)
          : Effect.fail(new SchemaIssue.InvalidValue(Option.some(value))),
    ),
    encode: SchemaGetter.transform((value) => (value ? "TRUE" : "FALSE")),
  }),
);
const toLiteralSchema = <const Literals extends Array.NonEmptyReadonlyArray<string>>(
  literals: Literals,
) =>
  Schema.String.pipe(
    Schema.decodeTo(Schema.Literals(literals), {
      decode: SchemaGetter.transformOrFail((value) =>
        Array.contains(literals, value)
          ? Effect.succeed(value as Literals[number])
          : Effect.fail(new SchemaIssue.InvalidValue(Option.some(value))),
      ),
      encode: SchemaGetter.String(),
    }),
  );
const toStringArraySchema = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Schema.Trim), {
    decode: SchemaGetter.transform((value) =>
      pipe(value.split(","), Array.map(String.trim), Array.filter(String.isNonEmpty)),
    ),
    encode: SchemaGetter.transform((value) => value.join(",")),
  }),
);

const colToNumber = (col: string) => {
  let result = 0;
  for (const char of col) {
    const upper = char.toUpperCase();
    result = result * 26 + (upper.charCodeAt(0) - 64);
  }
  return result;
};

const toRangeKey = (sheetTitle: string, startRow: number, startCol: number) =>
  `${sheetTitle}::${startRow}::${startCol}`;

const parseA1RangeKey = (range: string) =>
  pipe(
    /^(?:'((?:[^']|'')*)'|([^!]+))!(.+)$/u.exec(range),
    Option.fromNullishOr,
    Option.flatMap(([, quoted, unquoted, reference]) =>
      pipe(
        reference.split(":").at(0),
        Option.fromNullishOr,
        Option.flatMap((start) =>
          pipe(
            /^\$?([A-Za-z]+)\$?(\d+)$/u.exec(start),
            Option.fromNullishOr,
            Option.map(([, col, row]) =>
              toRangeKey(
                (quoted ?? unquoted ?? "").replace(/''/g, "'"),
                Number.parseInt(row, 10),
                colToNumber(col),
              ),
            ),
          ),
        ),
      ),
    ),
  );

const gridDataToKey = (sheetTitle: string, gridData: sheets_v4.Schema$GridData) =>
  toRangeKey(sheetTitle, (gridData.startRow ?? 0) + 1, (gridData.startColumn ?? 0) + 1);

export class GoogleSheets extends ServiceMap.Service<GoogleSheets>()("GoogleSheets", {
  make: Effect.gen(function* () {
    const googleAuthService = yield* GoogleAuthService;
    const auth = googleAuthService.getAuth();
    const googleSheets = yield* Effect.try({
      try: () =>
        sheets({
          version: "v4",
          auth,
        }),
      catch: (cause) =>
        GoogleSheetsError.makeUnsafe({
          message: "Failed to create Google Sheets client",
          cause,
        }),
    });

    return {
      sheets: googleSheets,
      getRowDatas: (
        params: sheets_v4.Params$Resource$Spreadsheets$Get,
        options?: MethodOptions,
      ) => {
        const response = pipe(
          Effect.tryPromise({
            try: () => googleSheets.spreadsheets.get(params, options),
            catch: Function.identity,
          }),
          Effect.catch((error) =>
            Effect.fail(
              GoogleSheetsError.makeUnsafe({
                message: pipe(
                  error,
                  Schema.decodeUnknownResult(Schema.Struct({ message: Schema.String })),
                  Result.map(({ message }) => message),
                  Result.getOrElse(() => "An unknown error occurred"),
                ),
                cause: error,
              }),
            ),
          ),
        );

        return pipe(
          response,
          Effect.map((sheet) =>
            pipe(
              sheet.data.sheets ?? [],
              Array.map((sheet) => ({
                sheet: sheet.properties?.title ?? "",
                gridData: sheet.data ?? [],
              })),
              Array.flatMap(({ sheet, gridData }) =>
                pipe(
                  gridData,
                  Array.map(
                    (gridData) => [gridDataToKey(sheet, gridData), gridData.rowData ?? []] as const,
                  ),
                ),
              ),
              HashMap.fromIterable,
            ),
          ),
          Effect.map((map) =>
            pipe(
              params.ranges ?? [],
              Array.map((range) =>
                pipe(
                  range,
                  parseA1RangeKey,
                  Option.flatMap((key) => HashMap.get(map, key)),
                ),
              ),
              Array.getSomes,
            ),
          ),
          Effect.flatMap((rowDatas) =>
            rowDatas.length === (params.ranges?.length ?? 0)
              ? Effect.succeed(rowDatas)
              : Effect.fail(
                  GoogleSheetsError.makeUnsafe({
                    message: "Row datas length does not match ranges length",
                    cause: undefined,
                  }),
                ),
          ),
          Effect.withSpan("GoogleSheets.getRowDatas"),
        );
      },
      get: (
        params: sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
        options?: MethodOptions,
      ) =>
        Effect.tryPromise({
          try: () => googleSheets.spreadsheets.values.batchGet(params, options),
          catch: Function.identity,
        }).pipe(
          Effect.catch((error) =>
            Effect.fail(
              GoogleSheetsError.makeUnsafe({
                message: pipe(
                  error,
                  Schema.decodeUnknownResult(Schema.Struct({ message: Schema.String })),
                  Result.map(({ message }) => message),
                  Result.getOrElse(() => "An unknown error occurred"),
                ),
                cause: error,
              }),
            ),
          ),
          Effect.withSpan("GoogleSheets.get"),
        ),
      getHashMap: <K>(
        ranges: HashMap.HashMap<K, string>,
        params?: Omit<sheets_v4.Params$Resource$Spreadsheets$Values$Batchget, "ranges">,
        options?: MethodOptions,
      ) =>
        pipe(
          ranges,
          Utils.hashMapPositional((orderedRanges: readonly string[]) =>
            Effect.tryPromise({
              try: () =>
                googleSheets.spreadsheets.values.batchGet(
                  { ...params, ranges: Array.copy(orderedRanges) },
                  options,
                ),
              catch: Function.identity,
            }).pipe(
              Effect.catch((error) =>
                Effect.fail(
                  GoogleSheetsError.makeUnsafe({
                    message: pipe(
                      error,
                      Schema.decodeUnknownResult(Schema.Struct({ message: Schema.String })),
                      Result.map(({ message }) => message),
                      Result.getOrElse(() => "An unknown error occurred"),
                    ),
                    cause: error,
                  }),
                ),
              ),
              Effect.map((response) => response.data.valueRanges ?? []),
            ),
          ),
          Effect.withSpan("GoogleSheets.getHashMap"),
        ),
      getRowDatasHashMap: <K>(
        ranges: HashMap.HashMap<K, string>,
        params?: Omit<sheets_v4.Params$Resource$Spreadsheets$Get, "ranges">,
        options?: MethodOptions,
      ) =>
        pipe(
          ranges,
          Utils.hashMapPositional((orderedRanges: readonly string[]) => {
            const response = Effect.tryPromise({
              try: () =>
                googleSheets.spreadsheets.get(
                  {
                    ...params,
                    ranges: Array.copy(orderedRanges),
                    includeGridData: true,
                  },
                  options,
                ),
              catch: Function.identity,
            }).pipe(
              Effect.catch((error) =>
                Effect.fail(
                  GoogleSheetsError.makeUnsafe({
                    message: pipe(
                      error,
                      Schema.decodeUnknownResult(Schema.Struct({ message: Schema.String })),
                      Result.map(({ message }) => message),
                      Result.getOrElse(() => "An unknown error occurred"),
                    ),
                    cause: error,
                  }),
                ),
              ),
            );

            return pipe(
              response,
              Effect.map((response) =>
                pipe(
                  response.data.sheets ?? [],
                  Array.map((sheet) => ({
                    sheet: sheet.properties?.title ?? "",
                    gridData: sheet.data ?? [],
                  })),
                  Array.flatMap(({ sheet, gridData }) =>
                    pipe(
                      gridData,
                      Array.map(
                        (data) => [gridDataToKey(sheet, data), data.rowData ?? []] as const,
                      ),
                    ),
                  ),
                  HashMap.fromIterable,
                ),
              ),
              Effect.flatMap((map) => {
                const rowDatas = pipe(
                  orderedRanges,
                  Array.map((range) =>
                    pipe(
                      range,
                      parseA1RangeKey,
                      Option.flatMap((key) => HashMap.get(map, key)),
                    ),
                  ),
                  Array.getSomes,
                );

                return rowDatas.length === orderedRanges.length
                  ? Effect.succeed(rowDatas)
                  : Effect.fail(
                      GoogleSheetsError.makeUnsafe({
                        message: "Row datas length does not match ranges length",
                        cause: undefined,
                      }),
                    );
              }),
            );
          }),
          Effect.withSpan("GoogleSheets.getRowDatasHashMap"),
        ),
      update: (
        params?: sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
        options?: MethodOptions,
      ) =>
        Effect.tryPromise({
          try: () => googleSheets.spreadsheets.values.batchUpdate(params, options),
          catch: Function.identity,
        }).pipe(
          Effect.catch((error) =>
            Effect.fail(
              GoogleSheetsError.makeUnsafe({
                message: pipe(
                  error,
                  Schema.decodeUnknownResult(Schema.Struct({ message: Schema.String })),
                  Result.map(({ message }) => message),
                  Result.getOrElse(() => "An unknown error occurred"),
                ),
                cause: error,
              }),
            ),
          ),
          Effect.withSpan("GoogleSheets.update"),
        ),
      getSheetGids: (sheetId: string) =>
        Effect.tryPromise({
          try: () => googleSheets.spreadsheets.get({ spreadsheetId: sheetId }),
          catch: Function.identity,
        }).pipe(
          Effect.catch((error) =>
            Effect.fail(
              GoogleSheetsError.makeUnsafe({
                message: pipe(
                  error,
                  Schema.decodeUnknownResult(Schema.Struct({ message: Schema.String })),
                  Result.map(({ message }) => message),
                  Result.getOrElse(() => "An unknown error occurred"),
                ),
                cause: error,
              }),
            ),
          ),
          Effect.map((sheet) =>
            pipe(
              sheet.data.sheets ?? [],
              Array.map((sheet) => sheet.properties),
              Array.map(Option.fromNullishOr),
              Array.getSomes,
              ArrayUtils.Collect.toHashMapByKey("title"),
              HashMap.map(({ sheetId }) => Option.fromNullishOr(sheetId)),
            ),
          ),
          Effect.withSpan("GoogleSheets.getSheetGids"),
        ),
    };
  }),
}) {
  static layer = Layer.effect(GoogleSheets, this.make).pipe(Layer.provide(GoogleAuthService.layer));

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
  static cellToStringSchema = Schema.Option(toStringSchema);
  static toNumberSchema = toNumberSchema;
  static cellToNumberSchema = Schema.Option(toNumberSchema);
  static toBooleanSchema = toBooleanSchema;
  static cellToBooleanSchema = Schema.Option(toBooleanSchema);
  static toLiteralSchema = toLiteralSchema;
  static cellToLiteralSchema = <const Literals extends Array.NonEmptyReadonlyArray<string>>(
    literals: Literals,
  ) => Schema.Option(toLiteralSchema(literals));
  static toStringArraySchema = toStringArraySchema;
  static cellToStringArraySchema = Schema.Option(toStringArraySchema);
}
