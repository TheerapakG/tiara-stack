import { Array, Effect, HashMap, Option, pipe } from "effect";
import { HttpClient } from "@effect/platform";
import { chromium } from "playwright";
import { SheetService } from "./sheet";
import { joinURL, withQuery } from "ufo";
import { Struct as StructUtils } from "typhoon-core/utils";
import { makeUnknownError } from "typhoon-core/error";
import { GoogleSheets } from "./google/sheets";

export class ScreenshotService extends Effect.Service<ScreenshotService>()("ScreenshotService", {
  effect: pipe(
    Effect.all(
      {
        googleSheets: GoogleSheets,
        sheetService: SheetService,
        httpClient: HttpClient.HttpClient,
      },
      { concurrency: "unbounded" },
    ),
    Effect.map(({ googleSheets, sheetService, httpClient }) => ({
      getScreenshot: (sheetId: string, channel: string, day: number) =>
        pipe(
          Effect.Do,
          Effect.bindAll(
            () => ({
              sheetGids: googleSheets.getSheetGids(sheetId),
              scheduleConfigs: sheetService.getScheduleConfig(sheetId),
            }),
            { concurrency: "unbounded" },
          ),
          Effect.map(({ sheetGids, scheduleConfigs }) => {
            const filteredConfig = pipe(
              scheduleConfigs,
              Array.map(
                StructUtils.GetSomeFields.getSomeFields(["channel", "day", "screenshotRange"]),
              ),
              Array.getSomes,
              Array.filter((a) => a.channel === channel && a.day === day),
              Array.head,
            );
            const sheetGid = filteredConfig.pipe(
              Option.flatMap((a) => a.sheet),
              Option.flatMap((a) => HashMap.get(sheetGids, a)),
              Option.flatten,
            );
            return { filteredConfig, sheetGid };
          }),
          Effect.flatMap(({ filteredConfig, sheetGid }) => {
            if (Option.isNone(filteredConfig)) {
              return Effect.fail(
                makeUnknownError(
                  "Could not generate screenshot URL",
                  new Error("Missing schedule config"),
                ),
              );
            }
            if (Option.isNone(sheetGid)) {
              return Effect.fail(
                makeUnknownError(
                  "Could not generate screenshot URL",
                  new Error("Missing sheet GID"),
                ),
              );
            }
            const config = filteredConfig.value;
            const url = withQuery(
              joinURL("https://docs.google.com/spreadsheets/d", `/${sheetId}`, `/htmlembed`),
              {
                single: true,
                gid: sheetGid.value,
                range: config.screenshotRange,
                widget: false,
                chrome: false,
                headers: false,
              },
            );
            return Effect.succeed({ url, config });
          }),
          Effect.tap(({ url }) => Effect.log(`Screenshot URL: ${url}`)),
          Effect.bind("css", () =>
            pipe(
              httpClient.get(
                withQuery("https://fonts.googleapis.com/css2", {
                  family: ["Lexend:wght@100..900", "Pacifico"],
                  display: "swap",
                }),
              ),
              Effect.flatMap((response) => response.text),
              Effect.catchAll((error) => Effect.fail(makeUnknownError("Error getting CSS", error))),
              Effect.map((css) =>
                css.replace(/font-family: '([^']+)';/g, `font-family: 'docs-$1';`),
              ),
            ),
          ),
          Effect.flatMap(({ url, css }) =>
            Effect.tryPromise({
              try: async () => {
                const browser = await chromium.launch();
                const context = await browser.newContext({
                  permissions: ["local-fonts"],
                });
                const page = await context.newPage();
                await page.goto(url);
                await page.addStyleTag({ content: css });
                const boundingBox = await page.locator("table").boundingBox();
                if (!boundingBox) {
                  throw new Error("Table not found");
                }
                await page.setViewportSize({
                  width: boundingBox.width,
                  height: boundingBox.height,
                });
                const buffer = await page.locator("table").screenshot({ type: "png" });
                await browser.close();
                return new Uint8Array(buffer);
              },
              catch: (error) => makeUnknownError("Error getting screenshot", error),
            }),
          ),
          Effect.withSpan("ScreenshotService.getScreenshot", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [GoogleSheets.Default, SheetService.Default],
  accessors: true,
}) {}
