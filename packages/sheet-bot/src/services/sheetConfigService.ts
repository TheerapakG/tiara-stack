import { type } from "arktype";
import { Effect, pipe } from "effect";
import { validate } from "typhoon-core/schema";
import { GoogleSheets } from "../google/sheets";

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
            Effect.map((response) =>
              Object.fromEntries(response.data.valueRanges?.[0]?.values ?? []),
            ),
            Effect.flatMap(
              validate(
                type({
                  "User IDs": "string",
                  "User Teams": "string",
                  Hours: "string",
                  Breaks: "string",
                  "Hour Players": "string",
                }).pipe((config) => ({
                  userIds: config["User IDs"],
                  userTeams: config["User Teams"],
                  hours: config["Hours"],
                  breaks: config["Breaks"],
                  hourPlayers: config["Hour Players"],
                })),
              ),
            ),
          ),
        getEventConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!E8:F"],
            }),
            Effect.map((response) =>
              Object.fromEntries(response.data.valueRanges?.[0]?.values ?? []),
            ),
            Effect.flatMap(
              validate(
                type({
                  "Start Time": "number",
                }).pipe((config) => ({
                  startTime: config["Start Time"],
                })),
              ),
            ),
          ),
      })),
    ),
    dependencies: [GoogleSheets.Default],
    accessors: true,
  },
) {}
