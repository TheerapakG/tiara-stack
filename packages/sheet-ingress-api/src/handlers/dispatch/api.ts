import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { SheetApisServiceUserFallback } from "../../middlewares/sheetApisServiceUserFallback/tag";
import {
  CheckinDispatchErrorSchemas,
  CheckinDispatchPayload,
  CheckinDispatchResult,
  CheckinHandleButtonErrorSchemas,
  CheckinHandleButtonPayload,
  CheckinHandleButtonResult,
  DispatchRoomOrderButtonMethods,
  RoomOrderDispatchErrorSchemas,
  RoomOrderDispatchPayload,
  RoomOrderDispatchResult,
  RoomOrderHandleButtonErrorSchemas,
  RoomOrderNextButtonPayload,
  RoomOrderNextButtonResult,
  RoomOrderPinTentativeButtonPayload,
  RoomOrderPinTentativeButtonResult,
  RoomOrderPreviousButtonPayload,
  RoomOrderPreviousButtonResult,
  RoomOrderSendButtonPayload,
  RoomOrderSendButtonResult,
} from "./schema";

export class DispatchApi extends HttpApiGroup.make("dispatch")
  .add(
    HttpApiEndpoint.post("checkin", "/dispatch/checkin", {
      payload: CheckinDispatchPayload,
      success: CheckinDispatchResult,
      error: CheckinDispatchErrorSchemas,
    }),
  )
  .add(
    HttpApiEndpoint.post("checkinButton", "/dispatch/checkin/buttons/handle", {
      payload: CheckinHandleButtonPayload,
      success: CheckinHandleButtonResult,
      error: CheckinHandleButtonErrorSchemas,
    }),
  )
  .add(
    HttpApiEndpoint.post("roomOrder", "/dispatch/roomOrder", {
      payload: RoomOrderDispatchPayload,
      success: RoomOrderDispatchResult,
      error: RoomOrderDispatchErrorSchemas,
    }),
  )
  .add(
    HttpApiEndpoint.post(
      DispatchRoomOrderButtonMethods.previous.endpointName,
      DispatchRoomOrderButtonMethods.previous.path,
      {
        payload: RoomOrderPreviousButtonPayload,
        success: RoomOrderPreviousButtonResult,
        error: RoomOrderHandleButtonErrorSchemas,
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      DispatchRoomOrderButtonMethods.next.endpointName,
      DispatchRoomOrderButtonMethods.next.path,
      {
        payload: RoomOrderNextButtonPayload,
        success: RoomOrderNextButtonResult,
        error: RoomOrderHandleButtonErrorSchemas,
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      DispatchRoomOrderButtonMethods.send.endpointName,
      DispatchRoomOrderButtonMethods.send.path,
      {
        payload: RoomOrderSendButtonPayload,
        success: RoomOrderSendButtonResult,
        error: RoomOrderHandleButtonErrorSchemas,
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      DispatchRoomOrderButtonMethods.pinTentative.endpointName,
      DispatchRoomOrderButtonMethods.pinTentative.path,
      {
        payload: RoomOrderPinTentativeButtonPayload,
        success: RoomOrderPinTentativeButtonResult,
        error: RoomOrderHandleButtonErrorSchemas,
      },
    ),
  )
  .middleware(SheetApisServiceUserFallback)
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Dispatch")
  .annotate(OpenApi.Description, "Dispatch and Discord interaction endpoints") {}
