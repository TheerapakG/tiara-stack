import { GoogleSheets } from "@/google/sheets";
import {
  ScheduleConfig,
  EventConfig,
  HourRange,
  RangesConfig,
  RunnerConfig,
  TeamConfig,
  TeamTagsConstantsConfig,
  TeamTagsRangesConfig,
  Error,
} from "@/server/schema";
import { type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Effect,
  HashMap,
  Number,
  Option,
  pipe,
  Schema,
  String,
  Match,
} from "effect";
import { DefaultTaggedClass } from "typhoon-core/schema";

const scheduleConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    GoogleSheets.parseValueRanges(
      [range],
      Schema.Tuple(
        pipe(
          GoogleSheets.rowToCellTupleSchema(11),
          Schema.compose(
            GoogleSheets.cellTupleToCellStructSchema([
              "channel",
              "day",
              "sheet",
              "hourRange",
              "breakRange",
              "monitorRange",
              "fillRange",
              "overfillRange",
              "standbyRange",
              "screenshotRange",
              "draft",
            ]),
          ),
          Schema.compose(
            Schema.Struct({
              channel: GoogleSheets.cellToStringSchema,
              day: GoogleSheets.cellToNumberSchema,
              sheet: GoogleSheets.cellToStringSchema,
              hourRange: GoogleSheets.cellToStringSchema,
              breakRange: GoogleSheets.cellToStringSchema,
              monitorRange: GoogleSheets.cellToStringSchema,
              fillRange: GoogleSheets.cellToStringSchema,
              overfillRange: GoogleSheets.cellToStringSchema,
              standbyRange: GoogleSheets.cellToStringSchema,
              screenshotRange: GoogleSheets.cellToStringSchema,
              draft: GoogleSheets.cellToStringSchema,
            }),
          ),
        ),
      ),
    ),
    Effect.map(Array.getRights),
    Effect.map(Array.map(([config]) => ScheduleConfig.make(config))),
    Effect.withSpan("scheduleConfigParser", { captureStackTrace: true }),
  );

export type TeamConfigMap = HashMap.HashMap<string, TeamConfig>;

const teamConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    GoogleSheets.parseValueRanges(
      [range],
      Schema.Tuple(
        pipe(
          GoogleSheets.rowToCellTupleSchema(9),
          Schema.compose(
            GoogleSheets.cellTupleToCellStructSchema([
              "name",
              "sheet",
              "playerNameRange",
              "teamNameRange",
              "leadRange",
              "backlineRange",
              "talentRange",
              "tagsType",
              "tags",
            ]),
          ),
          Schema.compose(
            pipe(
              Schema.Struct({
                name: GoogleSheets.cellToStringSchema,
                sheet: GoogleSheets.cellToStringSchema,
                playerNameRange: GoogleSheets.cellToStringSchema,
                teamNameRange: GoogleSheets.cellToStringSchema,
                leadRange: GoogleSheets.cellToStringSchema,
                backlineRange: GoogleSheets.cellToStringSchema,
                talentRange: GoogleSheets.cellToStringSchema,
                tagsType: GoogleSheets.cellToLiteralSchema([
                  "constants",
                  "ranges",
                ]),
                tags: GoogleSheets.cellToStringSchema,
              }),
            ),
          ),
        ),
      ),
    ),
    Effect.map(Array.getRights),
    Effect.map(
      Array.map(
        ([
          {
            name,
            sheet,
            playerNameRange,
            teamNameRange,
            leadRange,
            backlineRange,
            talentRange,
            tagsType,
            tags,
          },
        ]) =>
          TeamConfig.make({
            name,
            sheet,
            playerNameRange,
            teamNameRange,
            leadRange,
            backlineRange,
            talentRange,
            tagsConfig: pipe(
              tagsType,
              Option.flatMap((tagsType) =>
                pipe(
                  Match.value(tagsType),
                  Match.when("constants", () =>
                    Option.some(
                      new TeamTagsConstantsConfig({
                        tags: pipe(
                          tags,
                          Option.getOrElse(() => ""),
                          String.split(","),
                          Array.map(String.trim),
                          Array.filter(String.isNonEmpty),
                        ),
                      }),
                    ),
                  ),
                  Match.when("ranges", () =>
                    pipe(
                      tags,
                      Option.map(
                        (tags) => new TeamTagsRangesConfig({ tagsRange: tags }),
                      ),
                    ),
                  ),
                  Match.exhaustive,
                ),
              ),
            ),
          }),
      ),
    ),
    Effect.withSpan("teamConfigParser", { captureStackTrace: true }),
  );

const hourRangeParser = (range: string): HourRange =>
  pipe(
    pipe(
      range,
      String.split("-"),
      Array.map(String.trim),
      ([start, end]) =>
        new HourRange({
          start: parseInt(start, 10),
          end: parseInt(end, 10),
        }),
    ),
  );

const runnerConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    GoogleSheets.parseValueRanges(
      [range],
      Schema.Tuple(
        pipe(
          GoogleSheets.rowToCellTupleSchema(2),
          Schema.compose(
            GoogleSheets.cellTupleToCellStructSchema(["name", "hours"]),
          ),
          Schema.compose(
            pipe(
              Schema.Struct({
                name: GoogleSheets.cellToStringSchema,
                hours: GoogleSheets.cellToStringArraySchema,
              }),
            ),
          ),
        ),
      ),
    ),
    Effect.map(Array.getRights),
    Effect.map(
      Array.map(([{ name, hours }]) =>
        RunnerConfig.make({
          name,
          hours: pipe(
            hours,
            Option.getOrElse(() => []),
            Array.map(hourRangeParser),
          ),
        }),
      ),
    ),
    Effect.withSpan("runnerConfigParser", { captureStackTrace: true }),
  );

export class SheetConfigService extends Effect.Service<SheetConfigService>()(
  "SheetConfigService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("sheet", () => GoogleSheets),
      Effect.map(({ sheet }) => ({
        getRangesConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!B8:C"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.flatMap(Array.get(0)),
                Option.flatMap((range) => Option.fromNullable(range.values)),
                Option.map(Object.fromEntries),
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () =>
                    Effect.fail(
                      new Error.SheetConfigError({
                        message:
                          "Error getting ranges config, no value ranges found",
                      }),
                    ),
                }),
              ),
            ),
            Effect.flatMap(
              Schema.decodeUnknown(
                pipe(
                  Schema.Struct({
                    "User IDs": Schema.String,
                    "User Sheet Names": Schema.String,
                  }),
                  Schema.rename({
                    "User IDs": "userIds",
                    "User Sheet Names": "userSheetNames",
                  }),
                  Schema.compose(
                    DefaultTaggedClass.DefaultTaggedClass(RangesConfig),
                  ),
                ),
              ),
            ),
            Effect.withSpan("SheetConfigService.getRangesConfig", {
              captureStackTrace: true,
            }),
          ),
        getTeamConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!E8:M"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () =>
                    Effect.fail(
                      new Error.SheetConfigError({
                        message:
                          "Error getting team config, no value ranges found",
                      }),
                    ),
                }),
                Effect.flatMap(teamConfigParser),
                Effect.provideService(GoogleSheets, sheet),
              ),
            ),
            Effect.withSpan("SheetConfigService.getTeamConfig", {
              captureStackTrace: true,
            }),
          ),
        getEventConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!O8:P"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.flatMap(Array.get(0)),
                Option.flatMap((range) => Option.fromNullable(range.values)),
                Option.map(Object.fromEntries),
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () =>
                    Effect.fail(
                      new Error.SheetConfigError({
                        message:
                          "Error getting event config, no value ranges found",
                      }),
                    ),
                }),
              ),
            ),
            Effect.flatMap(
              Schema.decodeUnknown(
                pipe(
                  Schema.Struct({
                    "Start Time": pipe(
                      Schema.NumberFromString,
                      Schema.transform(Schema.Number, {
                        strict: true,
                        decode: Number.multiply(1000),
                        encode: Number.unsafeDivide(1000),
                      }),
                    ),
                  }),
                  Schema.rename({
                    "Start Time": "startTime",
                  }),
                  Schema.compose(
                    DefaultTaggedClass.DefaultTaggedClass(EventConfig),
                  ),
                ),
              ),
            ),
            Effect.withSpan("SheetConfigService.getEventConfig", {
              captureStackTrace: true,
            }),
          ),
        getScheduleConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!R8:AB"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () =>
                    Effect.fail(
                      new Error.SheetConfigError({
                        message:
                          "Error getting schedule config, no value ranges found",
                      }),
                    ),
                }),
                Effect.flatMap(scheduleConfigParser),
                Effect.provideService(GoogleSheets, sheet),
              ),
            ),
            Effect.withSpan("SheetConfigService.getScheduleConfig", {
              captureStackTrace: true,
            }),
          ),
        getRunnerConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!AD8:AE"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () =>
                    Effect.fail(
                      new Error.SheetConfigError({
                        message:
                          "Error getting runner config, no value ranges found",
                      }),
                    ),
                }),
                Effect.flatMap(runnerConfigParser),
                Effect.provideService(GoogleSheets, sheet),
              ),
            ),
            Effect.withSpan("SheetConfigService.getRunnerConfig", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [GoogleSheets.Default],
    accessors: true,
  },
) {}
