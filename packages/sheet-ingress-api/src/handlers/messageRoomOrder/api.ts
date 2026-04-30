import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, ArgumentError } from "typhoon-core/error";
import { QueryResultError } from "typhoon-zero/error";
import {
  MessageRoomOrder,
  MessageRoomOrderEntry,
  MessageRoomOrderRange,
} from "../../schemas/messageRoomOrder";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { SheetApisServiceUserFallback } from "../../middlewares/sheetApisServiceUserFallback/tag";

export class MessageRoomOrderApi extends HttpApiGroup.make("messageRoomOrder")
  .add(
    HttpApiEndpoint.get("getMessageRoomOrder", "/messageRoomOrder/getMessageRoomOrder", {
      query: Schema.Struct({
        messageId: Schema.String,
      }),
      success: MessageRoomOrder,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post("upsertMessageRoomOrder", "/messageRoomOrder/upsertMessageRoomOrder", {
      payload: Schema.Struct({
        messageId: Schema.String,
        data: Schema.Struct({
          previousFills: Schema.Array(Schema.String),
          fills: Schema.Array(Schema.String),
          hour: Schema.Number,
          rank: Schema.Number,
          monitor: Schema.optional(Schema.NullOr(Schema.String)),
          guildId: Schema.NullOr(Schema.String),
          messageChannelId: Schema.NullOr(Schema.String),
          createdByUserId: Schema.NullOr(Schema.String),
        }),
      }),
      success: MessageRoomOrder,
      error: [SchemaError, QueryResultError],
    }),
  )
  .add(
    HttpApiEndpoint.post("persistMessageRoomOrder", "/messageRoomOrder/persistMessageRoomOrder", {
      payload: Schema.Struct({
        messageId: Schema.String,
        data: Schema.Struct({
          previousFills: Schema.Array(Schema.String),
          fills: Schema.Array(Schema.String),
          hour: Schema.Number,
          rank: Schema.Number,
          monitor: Schema.optional(Schema.NullOr(Schema.String)),
          guildId: Schema.NullOr(Schema.String),
          messageChannelId: Schema.NullOr(Schema.String),
          createdByUserId: Schema.NullOr(Schema.String),
        }),
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
      success: MessageRoomOrder,
      error: [SchemaError, QueryResultError],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "decrementMessageRoomOrderRank",
      "/messageRoomOrder/decrementMessageRoomOrderRank",
      {
        payload: Schema.Struct({
          messageId: Schema.String,
        }),
        success: MessageRoomOrder,
        error: [SchemaError, QueryResultError, ArgumentError],
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "incrementMessageRoomOrderRank",
      "/messageRoomOrder/incrementMessageRoomOrderRank",
      {
        payload: Schema.Struct({
          messageId: Schema.String,
        }),
        success: MessageRoomOrder,
        error: [SchemaError, QueryResultError, ArgumentError],
      },
    ),
  )
  .add(
    HttpApiEndpoint.get("getMessageRoomOrderEntry", "/messageRoomOrder/getMessageRoomOrderEntry", {
      query: Schema.Struct({
        messageId: Schema.String,
        rank: Schema.NumberFromString,
      }),
      success: Schema.Array(MessageRoomOrderEntry),
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getMessageRoomOrderRange", "/messageRoomOrder/getMessageRoomOrderRange", {
      query: Schema.Struct({
        messageId: Schema.String,
      }),
      success: MessageRoomOrderRange,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "upsertMessageRoomOrderEntry",
      "/messageRoomOrder/upsertMessageRoomOrderEntry",
      {
        payload: Schema.Struct({
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
        success: Schema.Array(MessageRoomOrderEntry),
        error: [SchemaError, QueryResultError, ArgumentError],
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "removeMessageRoomOrderEntry",
      "/messageRoomOrder/removeMessageRoomOrderEntry",
      {
        payload: Schema.Struct({
          messageId: Schema.String,
        }),
        success: Schema.Array(MessageRoomOrderEntry),
        error: [SchemaError, QueryResultError, ArgumentError],
      },
    ),
  )
  .middleware(SheetApisServiceUserFallback)
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Message Room Order")
  .annotate(OpenApi.Description, "Message room order endpoints") {}
