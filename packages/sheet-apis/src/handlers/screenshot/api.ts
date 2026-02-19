import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, UnknownError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";

const ScreenshotError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
  UnknownError,
);

export class ScreenshotApi extends HttpApiGroup.make("screenshot")
  .add(
    HttpApiEndpoint.get("getScreenshot", "/screenshot/getScreenshot")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          channel: Schema.String,
          day: Schema.NumberFromString,
        }),
      )
      .addSuccess(Schema.Uint8Array)
      .addError(ScreenshotError),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Screenshot")
  .annotate(OpenApi.Description, "Screenshot endpoints") {}
