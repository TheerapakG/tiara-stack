import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { MessageSlot } from "@/schemas/messageSlot";

export class MessageSlotApi extends HttpApiGroup.make("messageSlot")
  .add(
    HttpApiEndpoint.get("getMessageSlotData", "/messageSlot/getMessageSlotData")
      .setUrlParams(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(Schema.OptionFromNullishOr(MessageSlot, undefined))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("upsertMessageSlotData", "/messageSlot/upsertMessageSlotData")
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
          day: Schema.Number,
        }),
      )
      .addSuccess(MessageSlot)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .annotate(OpenApi.Title, "Message Slot")
  .annotate(OpenApi.Description, "Message slot endpoints") {}
