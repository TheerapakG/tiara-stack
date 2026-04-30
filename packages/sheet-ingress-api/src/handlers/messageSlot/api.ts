import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, ArgumentError } from "typhoon-core/error";
import { QueryResultError } from "typhoon-zero/error";
import { MessageSlot } from "../../schemas/messageSlot";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { SheetApisServiceUserFallback } from "../../middlewares/sheetApisServiceUserFallback/tag";

export class MessageSlotApi extends HttpApiGroup.make("messageSlot")
  .add(
    HttpApiEndpoint.get("getMessageSlotData", "/messageSlot/getMessageSlotData", {
      query: Schema.Struct({
        messageId: Schema.String,
      }),
      success: MessageSlot,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post("upsertMessageSlotData", "/messageSlot/upsertMessageSlotData", {
      payload: Schema.Struct({
        messageId: Schema.String,
        data: Schema.Struct({
          day: Schema.Number,
          guildId: Schema.NullOr(Schema.String),
          messageChannelId: Schema.NullOr(Schema.String),
          createdByUserId: Schema.NullOr(Schema.String),
        }),
      }),
      success: MessageSlot,
      error: [SchemaError, QueryResultError],
    }),
  )
  .middleware(SheetApisServiceUserFallback)
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Message Slot")
  .annotate(OpenApi.Description, "Message slot endpoints") {}
