import {
  EventConfig,
  HourRange,
  RangesConfig,
  RunnerConfig,
  ScheduleConfig,
  SheetConfigError,
  TeamConfig,
  TeamTagsConstantsConfig,
  TeamTagsRangesConfig,
  TeamIsvCombinedConfig,
  TeamIsvSplitConfig,
} from "@/schemas/sheetConfig";
import { type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Effect,
  Option,
  pipe,
  Schema,
  SchemaGetter,
  ServiceMap,
  String,
  Layer,
} from "effect";
import { DefaultTaggedClass, OptionArrayToOptionStructValueSchema } from "typhoon-core/schema";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { ScopedCache } from "typhoon-core/utils";
import { GoogleSheets } from "./google/sheets";

const makeSheetConfigError = (message: string) =>
  SheetConfigError.makeUnsafe({
    message,
  });

const getValueRangesOrFail =
  (message: string) => (valueRanges: sheets_v4.Schema$ValueRange[] | null | undefined) =>
    pipe(
      valueRanges,
      Option.fromNullishOr,
      Option.match({
        onSome: Effect.succeed,
        onNone: () => Effect.fail(makeSheetConfigError(message)),
      }),
    );

const getEntriesOrFail =
  (message: string) => (range: sheets_v4.Schema$ValueRange | null | undefined) =>
    pipe(
      range,
      Option.fromNullishOr,
      Option.flatMap((valueRange) => Option.fromNullishOr(valueRange.values)),
      Option.match({
        onSome: (entries) => Effect.succeed(Object.fromEntries(entries)),
        onNone: () => Effect.fail(makeSheetConfigError(message)),
      }),
    );

const getFirstRangeEntriesOrFail =
  (message: string) => (valueRanges: sheets_v4.Schema$ValueRange[] | null | undefined) =>
    pipe(
      valueRanges,
      Option.fromNullishOr,
      Option.match({
        onSome: (ranges) => getEntriesOrFail(message)(ranges[0]),
        onNone: () => Effect.fail(makeSheetConfigError(message)),
      }),
    );

const scheduleConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  GoogleSheets.parseValueRanges(
    [range],
    Schema.Tuple([
      OptionArrayToOptionStructValueSchema(
        [
          "channel",
          "day",
          "sheet",
          "hourRange",
          "breakRange",
          "monitorRange",
          "encType",
          "fillRange",
          "overfillRange",
          "standbyRange",
          "screenshotRange",
          "visibleCell",
          "draft",
        ],
        Schema.String,
      ).pipe(
        Schema.decodeTo(
          Schema.Struct({
            channel: GoogleSheets.cellToStringSchema,
            day: GoogleSheets.cellToNumberSchema,
            sheet: GoogleSheets.cellToStringSchema,
            hourRange: GoogleSheets.cellToStringSchema,
            breakRange: GoogleSheets.cellToStringSchema,
            monitorRange: GoogleSheets.cellToStringSchema,
            encType: GoogleSheets.cellToLiteralSchema(["none", "regex"]),
            fillRange: GoogleSheets.cellToStringSchema,
            overfillRange: GoogleSheets.cellToStringSchema,
            standbyRange: GoogleSheets.cellToStringSchema,
            screenshotRange: GoogleSheets.cellToStringSchema,
            visibleCell: GoogleSheets.cellToStringSchema,
            draft: GoogleSheets.cellToStringSchema,
          }),
        ),
      ),
    ]),
  ).pipe(
    Effect.map(Array.getSuccesses),
    Effect.map(Array.map(([config]) => ScheduleConfig.makeUnsafe(config))),
    Effect.withSpan("scheduleConfigParser"),
  );

export type TeamConfigMap = Map<string, TeamConfig>;

const parseTeamIsvConfig = (
  isvType: Option.Option<"split" | "combined">,
  isvRanges: Option.Option<string>,
) =>
  Option.match(isvType, {
    onNone: () => Option.none<TeamIsvSplitConfig | TeamIsvCombinedConfig>(),
    onSome: (type) => {
      if (type === "split") {
        return pipe(
          isvRanges,
          Option.flatMap((value) => {
            const [leadRange, backlineRange, talentRange] = value
              .split(",")
              .map((item) => item.trim());

            return leadRange && backlineRange && talentRange
              ? Option.some(
                  TeamIsvSplitConfig.makeUnsafe({
                    leadRange,
                    backlineRange,
                    talentRange,
                  }),
                )
              : Option.none<TeamIsvSplitConfig>();
          }),
        );
      }

      return pipe(
        isvRanges,
        Option.map((value) => TeamIsvCombinedConfig.makeUnsafe({ isvRange: value })),
      );
    },
  });

const parseTeamTagsConfig = (
  tagsType: Option.Option<"constants" | "ranges">,
  tags: Option.Option<string>,
) =>
  Option.match(tagsType, {
    onNone: () => Option.none<TeamTagsConstantsConfig | TeamTagsRangesConfig>(),
    onSome: (type) => {
      if (type === "constants") {
        return Option.some(
          TeamTagsConstantsConfig.makeUnsafe({
            tags: pipe(
              tags,
              Option.getOrElse(() => ""),
              String.split(","),
              Array.map(String.trim),
              Array.filter(String.isNonEmpty),
            ),
          }),
        );
      }

      return pipe(
        tags,
        Option.map((value) => TeamTagsRangesConfig.makeUnsafe({ tagsRange: value })),
      );
    },
  });

const teamConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  GoogleSheets.parseValueRanges(
    [range],
    Schema.Tuple([
      OptionArrayToOptionStructValueSchema(
        [
          "name",
          "sheet",
          "playerNameRange",
          "teamNameRange",
          "isvType",
          "isvRanges",
          "tagsType",
          "tags",
        ],
        Schema.String,
      ).pipe(
        Schema.decodeTo(
          Schema.Struct({
            name: GoogleSheets.cellToStringSchema,
            sheet: GoogleSheets.cellToStringSchema,
            playerNameRange: GoogleSheets.cellToStringSchema,
            teamNameRange: GoogleSheets.cellToStringSchema,
            isvType: GoogleSheets.cellToLiteralSchema(["split", "combined"]),
            isvRanges: GoogleSheets.cellToStringSchema,
            tagsType: GoogleSheets.cellToLiteralSchema(["constants", "ranges"]),
            tags: GoogleSheets.cellToStringSchema,
          }),
        ),
      ),
    ]),
  ).pipe(
    Effect.map(Array.getSuccesses),
    Effect.map(
      Array.map(
        ([{ name, sheet, playerNameRange, teamNameRange, isvType, isvRanges, tagsType, tags }]) =>
          TeamConfig.makeUnsafe({
            name,
            sheet,
            playerNameRange,
            teamNameRange,
            isvConfig: parseTeamIsvConfig(isvType, isvRanges),
            tagsConfig: parseTeamTagsConfig(tagsType, tags),
          }),
      ),
    ),
    Effect.withSpan("teamConfigParser"),
  );

const hourRangeParser = (range: string): HourRange => {
  const [start, end] = range.split("-").map((item) => item.trim());
  return new HourRange({
    start: Number.parseInt(start, 10),
    end: Number.parseInt(end, 10),
  });
};

const runnerConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  GoogleSheets.parseValueRanges(
    [range],
    Schema.Tuple([
      OptionArrayToOptionStructValueSchema(["name", "hours"], Schema.String).pipe(
        Schema.decodeTo(
          Schema.Struct({
            name: GoogleSheets.cellToStringSchema,
            hours: GoogleSheets.cellToStringArraySchema,
          }),
        ),
      ),
    ]),
  ).pipe(
    Effect.map(Array.getSuccesses),
    Effect.map(
      Array.map(([{ name, hours }]) =>
        RunnerConfig.makeUnsafe({
          name,
          hours: pipe(
            hours,
            Option.getOrElse(() => []),
            Array.map(hourRangeParser),
          ),
        }),
      ),
    ),
    Effect.withSpan("runnerConfigParser"),
  );

const rangesConfigSchema = Schema.Struct({
  userIds: Schema.String,
  userSheetNames: Schema.String,
  userNotes: Schema.OptionFromNullishOr(Schema.String),
  monitorIds: Schema.OptionFromNullishOr(Schema.String),
  monitorNames: Schema.OptionFromNullishOr(Schema.String),
}).pipe(Schema.decodeTo(DefaultTaggedClass(RangesConfig)));

const eventConfigSchema = Schema.Struct({
  startTime: Schema.NumberFromString.pipe(
    Schema.decodeTo(Schema.Number, {
      decode: SchemaGetter.transform((value) => value * 1000),
      encode: SchemaGetter.transform((value) => value / 1000),
    }),
  ),
}).pipe(Schema.decodeTo(DefaultTaggedClass(EventConfig)));

export class SheetConfigService extends ServiceMap.Service<SheetConfigService>()(
  "SheetConfigService",
  {
    make: Effect.gen(function* () {
      const googleSheets = yield* GoogleSheets;

      const getRangesConfig = Effect.fn("SheetConfigService.getRangesConfig")(function* (
        sheetId: string,
      ) {
        const response = yield* googleSheets.get({
          spreadsheetId: sheetId,
          ranges: ["'Thee's Sheet Settings'!B8:C"],
        });
        const rawEntries = yield* getFirstRangeEntriesOrFail(
          "Error getting ranges config, no value ranges found",
        )(response.data.valueRanges);
        const entries = {
          userIds: rawEntries["User IDs"],
          userSheetNames: rawEntries["User Sheet Names"],
          userNotes: rawEntries["User Notes"],
          monitorIds: rawEntries["Moni IDs"],
          monitorNames: rawEntries["Moni Names"],
        };

        return yield* Schema.decodeUnknownEffect(rangesConfigSchema)(entries).pipe(
          catchSchemaErrorAsValidationError,
          Effect.withSpan("SheetConfigService.getRangesConfig"),
        );
      });

      const getTeamConfig = Effect.fn("SheetConfigService.getTeamConfig")(function* (
        sheetId: string,
      ) {
        const response = yield* googleSheets.get({
          spreadsheetId: sheetId,
          ranges: ["'Thee's Sheet Settings'!E8:L"],
        });
        const valueRanges = yield* getValueRangesOrFail(
          "Error getting team config, no value ranges found",
        )(response.data.valueRanges);

        return yield* teamConfigParser(valueRanges).pipe(
          catchSchemaErrorAsValidationError,
          Effect.withSpan("SheetConfigService.getTeamConfig"),
        );
      });

      const getEventConfig = Effect.fn("SheetConfigService.getEventConfig")(function* (
        sheetId: string,
      ) {
        const response = yield* googleSheets.get({
          spreadsheetId: sheetId,
          ranges: ["'Thee's Sheet Settings'!N8:O"],
        });
        const rawEntries = yield* getFirstRangeEntriesOrFail(
          "Error getting event config, no value ranges found",
        )(response.data.valueRanges);
        const entries = {
          startTime: rawEntries["Start Time"],
        };

        return yield* Schema.decodeUnknownEffect(eventConfigSchema)(entries).pipe(
          catchSchemaErrorAsValidationError,
          Effect.withSpan("SheetConfigService.getEventConfig"),
        );
      });

      const getScheduleConfig = Effect.fn("SheetConfigService.getScheduleConfig")(function* (
        sheetId: string,
      ) {
        const response = yield* googleSheets.get({
          spreadsheetId: sheetId,
          ranges: ["'Thee's Sheet Settings'!Q8:AB"],
        });
        const valueRanges = yield* getValueRangesOrFail(
          "Error getting schedule config, no value ranges found",
        )(response.data.valueRanges);

        return yield* scheduleConfigParser(valueRanges).pipe(
          catchSchemaErrorAsValidationError,
          Effect.withSpan("SheetConfigService.getScheduleConfig"),
        );
      });

      const getRunnerConfig = Effect.fn("SheetConfigService.getRunnerConfig")(function* (
        sheetId: string,
      ) {
        const response = yield* googleSheets.get({
          spreadsheetId: sheetId,
          ranges: ["'Thee's Sheet Settings'!AE8:AF"],
        });
        const valueRanges = yield* getValueRangesOrFail(
          "Error getting runner config, no value ranges found",
        )(response.data.valueRanges);

        return yield* runnerConfigParser(valueRanges).pipe(
          catchSchemaErrorAsValidationError,
          Effect.withSpan("SheetConfigService.getRunnerConfig"),
        );
      });

      const {
        getRangesConfigCache,
        getTeamConfigCache,
        getEventConfigCache,
        getScheduleConfigCache,
        getRunnerConfigCache,
      } = yield* Effect.all({
        getRangesConfigCache: ScopedCache.make({ lookup: getRangesConfig }),
        getTeamConfigCache: ScopedCache.make({ lookup: getTeamConfig }),
        getEventConfigCache: ScopedCache.make({ lookup: getEventConfig }),
        getScheduleConfigCache: ScopedCache.make({ lookup: getScheduleConfig }),
        getRunnerConfigCache: ScopedCache.make({ lookup: getRunnerConfig }),
      });

      return {
        getRangesConfig: (sheetId: string) => getRangesConfigCache.get(sheetId),
        getTeamConfig: (sheetId: string) => getTeamConfigCache.get(sheetId),
        getEventConfig: (sheetId: string) => getEventConfigCache.get(sheetId),
        getScheduleConfig: (sheetId: string) => getScheduleConfigCache.get(sheetId),
        getRunnerConfig: (sheetId: string) => getRunnerConfigCache.get(sheetId),
      };
    }),
  },
) {
  static layer = Layer.effect(SheetConfigService, this.make).pipe(
    Layer.provide(GoogleSheets.layer),
  );
}
