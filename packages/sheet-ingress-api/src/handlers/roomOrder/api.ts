import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, ArgumentError, UnknownError } from "typhoon-core/error";
import { QueryResultError } from "typhoon-zero/error";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { SheetApisServiceUserFallback } from "../../middlewares/sheetApisServiceUserFallback/tag";
import { RoomOrderGenerateResult } from "../../schemas/roomOrder";
import { GoogleSheetsError } from "../../schemas/google";
import { ParserFieldError } from "../../schemas/sheet/error";
import { SheetConfigError } from "../../schemas/sheetConfig";
import {
  RoomOrderDispatchPayload,
  RoomOrderDispatchResult,
  RoomOrderButtonMethods,
  RoomOrderNextButtonPayload,
  RoomOrderNextButtonResult,
  RoomOrderPinTentativeButtonPayload,
  RoomOrderPinTentativeButtonResult,
  RoomOrderPreviousButtonPayload,
  RoomOrderPreviousButtonResult,
  RoomOrderSendButtonPayload,
  RoomOrderSendButtonResult,
} from "../../sheet-apis-rpc";

const RoomOrderGenerateError = [
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  SchemaError,
  QueryResultError,
  ArgumentError,
];

const RoomOrderDispatchError = [...RoomOrderGenerateError, UnknownError];
const RoomOrderHandleButtonError = [
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  SchemaError,
  QueryResultError,
  ArgumentError,
  UnknownError,
];

export class RoomOrderApi extends HttpApiGroup.make("roomOrder")
  .add(
    HttpApiEndpoint.post("generate", "/roomOrder/generate", {
      payload: Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.optional(Schema.String),
        channelName: Schema.optional(Schema.String),
        hour: Schema.optional(Schema.Number),
        healNeeded: Schema.optional(Schema.Number),
      }),
      success: RoomOrderGenerateResult,
      error: RoomOrderGenerateError,
    }),
  )
  .add(
    HttpApiEndpoint.post("dispatch", "/roomOrder/dispatch", {
      payload: RoomOrderDispatchPayload,
      success: RoomOrderDispatchResult,
      error: RoomOrderDispatchError,
    }),
  )
  .add(
    HttpApiEndpoint.post(
      RoomOrderButtonMethods.previous.endpointName,
      RoomOrderButtonMethods.previous.path,
      {
        payload: RoomOrderPreviousButtonPayload,
        success: RoomOrderPreviousButtonResult,
        error: RoomOrderHandleButtonError,
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      RoomOrderButtonMethods.next.endpointName,
      RoomOrderButtonMethods.next.path,
      {
        payload: RoomOrderNextButtonPayload,
        success: RoomOrderNextButtonResult,
        error: RoomOrderHandleButtonError,
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      RoomOrderButtonMethods.send.endpointName,
      RoomOrderButtonMethods.send.path,
      {
        payload: RoomOrderSendButtonPayload,
        success: RoomOrderSendButtonResult,
        error: RoomOrderHandleButtonError,
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      RoomOrderButtonMethods.pinTentative.endpointName,
      RoomOrderButtonMethods.pinTentative.path,
      {
        payload: RoomOrderPinTentativeButtonPayload,
        success: RoomOrderPinTentativeButtonResult,
        error: RoomOrderHandleButtonError,
      },
    ),
  )
  .middleware(SheetApisServiceUserFallback)
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Room Order")
  .annotate(OpenApi.Description, "Room order generation endpoints") {}
