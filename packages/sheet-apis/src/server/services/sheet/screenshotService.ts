import { GoogleSheets } from "@/google/sheets";
import { Array, Effect, HashMap, Number, pipe, String } from "effect";
import { chromium } from "playwright";
import { SheetService } from "./sheetService";
import { joinURL, withQuery } from "ufo";
import screenshotServiceStyle from "./screenshotServiceStyle.css";

export class ScreenshotService extends Effect.Service<ScreenshotService>()(
  "ScreenshotService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          sheetService: SheetService,
        }),
        { concurrency: "unbounded" },
      ),
      Effect.bindAll(
        ({ sheetService }) => ({
          sheetGids: Effect.cached(
            pipe(
              sheetService.getSheetGids(),
              Effect.withSpan("ScreenshotService.sheetGids", {
                captureStackTrace: true,
              }),
            ),
          ),
          scheduleConfig: Effect.cached(
            pipe(
              sheetService.getScheduleConfig(),
              Effect.withSpan("ScreenshotService.scheduleConfig", {
                captureStackTrace: true,
              }),
            ),
          ),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.map(({ sheetService, sheetGids, scheduleConfig }) => ({
        getScreenshot: (channel: string, day: number) =>
          pipe(
            Effect.Do,
            Effect.bindAll(
              () => ({
                scheduleConfigs: scheduleConfig,
              }),
              { concurrency: "unbounded" },
            ),
            Effect.bind("filteredScheduleConfig", ({ scheduleConfigs }) =>
              pipe(
                scheduleConfigs,
                Array.filter(
                  (a) =>
                    String.Equivalence(a.channel, channel) &&
                    Number.Equivalence(a.day, day),
                ),
                Array.head,
              ),
            ),
            Effect.bind("sheetGid", ({ filteredScheduleConfig }) =>
              pipe(
                sheetGids,
                Effect.flatMap(HashMap.get(filteredScheduleConfig.sheet)),
              ),
            ),
            Effect.bind(
              "screenshotRange",
              ({ filteredScheduleConfig }) =>
                filteredScheduleConfig.screenshotRange,
            ),
            Effect.let("url", ({ sheetGid, screenshotRange }) =>
              withQuery(
                joinURL(
                  "https://docs.google.com/spreadsheets/d",
                  `/${sheetService.sheetId}`,
                  `/htmlembed/sheet`,
                ),
                {
                  gid: sheetGid,
                  range: screenshotRange,
                },
              ),
            ),
            Effect.flatMap(({ url }) =>
              Effect.tryPromise(async () => {
                const browser = await chromium.launch();
                const context = await browser.newContext({
                  permissions: ["local-fonts"],
                });
                const page = await context.newPage();
                await page.goto(url);
                await page.addStyleTag({ content: screenshotServiceStyle });
                const boundingBox = await page.locator("table").boundingBox();
                if (!boundingBox) {
                  throw new Error("Table not found");
                }
                await page.setViewportSize({
                  width: boundingBox.width,
                  height: boundingBox.height,
                });
                const buffer = await page
                  .locator("table")
                  .screenshot({ type: "png" });
                await browser.close();
                return new Uint8Array(buffer);
              }),
            ),
            Effect.withSpan("ScreenshotService.getScreenshot", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [GoogleSheets.Default],
    accessors: true,
  },
) {}
