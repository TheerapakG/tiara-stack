import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { CheckinGenerateResult } from "@/schemas/checkin";

const CheckinGenerateError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
  ArgumentError,
);

export class CheckinApi extends HttpApiGroup.make("checkin")
  .add(
    HttpApiEndpoint.post("generate", "/checkin/generate")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.optional(Schema.String),
          channelName: Schema.optional(Schema.String),
          hour: Schema.optional(Schema.Number),
          template: Schema.optional(Schema.String),
        }),
      )
      .addSuccess(CheckinGenerateResult)
      .addError(CheckinGenerateError),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Check-in")
  .annotate(OpenApi.Description, "Check-in generation endpoints") {}
