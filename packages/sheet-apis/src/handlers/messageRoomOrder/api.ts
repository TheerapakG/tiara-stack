import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import {
  MessageRoomOrder,
  MessageRoomOrderEntry,
  MessageRoomOrderRange,
} from "@/schemas/messageRoomOrder";

export class MessageRoomOrderApi extends HttpApiGroup.make("messageRoomOrder")
  .add(
    HttpApiEndpoint.get("getMessageRoomOrder", "/messageRoomOrder/getMessageRoomOrder")
      .setUrlParams(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(MessageRoomOrder)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .add(
    HttpApiEndpoint.post("upsertMessageRoomOrder", "/messageRoomOrder/upsertMessageRoomOrder")
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
          previousFills: Schema.Array(Schema.String),
          fills: Schema.Array(Schema.String),
          hour: Schema.Number,
          rank: Schema.Number,
          monitor: Schema.optionalWith(Schema.String, { nullable: true }),
        }),
      )
      .addSuccess(MessageRoomOrder)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post(
      "decrementMessageRoomOrderRank",
      "/messageRoomOrder/decrementMessageRoomOrderRank",
    )
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(MessageRoomOrder)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post(
      "incrementMessageRoomOrderRank",
      "/messageRoomOrder/incrementMessageRoomOrderRank",
    )
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(MessageRoomOrder)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getMessageRoomOrderEntry", "/messageRoomOrder/getMessageRoomOrderEntry")
      .setUrlParams(
        Schema.Struct({
          messageId: Schema.String,
          rank: Schema.String,
        }),
      )
      .addSuccess(Schema.Array(MessageRoomOrderEntry))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getMessageRoomOrderRange", "/messageRoomOrder/getMessageRoomOrderRange")
      .setUrlParams(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(MessageRoomOrderRange)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .add(
    HttpApiEndpoint.post(
      "upsertMessageRoomOrderEntry",
      "/messageRoomOrder/upsertMessageRoomOrderEntry",
    )
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
          entries: Schema.Array(
            Schema.Struct({
              rank: Schema.Number,
              position: Schema.Number,
              hour: Schema.Number,
              team: Schema.String,
              tags: Schema.Array(Schema.String),
              effectValue: Schema.Number,
            }),
          ),
        }),
      )
      .addSuccess(Schema.Array(MessageRoomOrderEntry))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post(
      "removeMessageRoomOrderEntry",
      "/messageRoomOrder/removeMessageRoomOrderEntry",
    )
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(Schema.Array(MessageRoomOrderEntry))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .annotate(OpenApi.Title, "Message Room Order")
  .annotate(OpenApi.Description, "Message room order endpoints") {}
