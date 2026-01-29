import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, UnknownError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";

const ScreenshotError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  UnknownError,
);

export class ScreenshotApi extends HttpApiGroup.make("screenshot")
  .add(
    HttpApiEndpoint.get("getScreenshot", "/screenshot/getScreenshot")
      .setUrlParams(
        Schema.Struct({
          sheetId: Schema.String,
          channel: Schema.String,
          day: Schema.NumberFromString,
        }),
      )
      .addSuccess(Schema.Uint8Array)
      .addError(ScreenshotError),
  )
  .annotate(OpenApi.Title, "Screenshot")
  .annotate(OpenApi.Description, "Screenshot endpoints") {}
