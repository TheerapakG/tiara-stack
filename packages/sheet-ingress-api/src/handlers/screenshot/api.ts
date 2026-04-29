import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, UnknownError } from "typhoon-core/error";
import { QueryResultError } from "typhoon-zero/error";
import { GoogleSheetsError } from "../../schemas/google";
import { ParserFieldError } from "../../schemas/sheet/error";
import { SheetConfigError } from "../../schemas/sheetConfig";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";

const ScreenshotError = [
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  SchemaError,
  QueryResultError,
  UnknownError,
];

export class ScreenshotApi extends HttpApiGroup.make("screenshot")
  .add(
    HttpApiEndpoint.get("getScreenshot", "/screenshot/getScreenshot", {
      query: Schema.Struct({
        guildId: Schema.String,
        channel: Schema.String,
        day: Schema.NumberFromString,
      }),
      success: Schema.Uint8Array,
      error: ScreenshotError,
    }),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Screenshot")
  .annotate(OpenApi.Description, "Screenshot endpoints") {}
