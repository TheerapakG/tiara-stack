import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";
import { RoomOrderGenerateResult } from "@/schemas/roomOrder";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";

const RoomOrderGenerateError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
  ArgumentError,
);

export class RoomOrderApi extends HttpApiGroup.make("roomOrder")
  .add(
    HttpApiEndpoint.post("generate", "/roomOrder/generate")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.optional(Schema.String),
          channelName: Schema.optional(Schema.String),
          hour: Schema.optional(Schema.Number),
          healNeeded: Schema.optional(Schema.Number),
        }),
      )
      .addSuccess(RoomOrderGenerateResult)
      .addError(RoomOrderGenerateError),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Room Order")
  .annotate(OpenApi.Description, "Room order generation endpoints") {}
