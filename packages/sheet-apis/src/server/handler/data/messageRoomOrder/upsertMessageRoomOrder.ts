import { Error, MessageRoomOrder } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const upsertMessageRoomOrderHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("mutation"),
  Handler.Data.Builder.name("messageRoomOrder.upsertMessageRoomOrder"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        messageId: Schema.String,
        hour: Schema.Number,
        previousFills: Schema.Array(Schema.String),
        fills: Schema.Array(Schema.String),
        rank: Schema.Number,
        monitor: Schema.optional(Schema.NullishOr(Schema.String)),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(MessageRoomOrder, Schema.standardSchemaV1),
  }),
  Handler.Data.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.AuthorizationError,
        Error.Core.DBQueryError,
        Error.Core.MsgpackDecodeError,
        Error.Core.StreamExhaustedError,
        Error.Core.ValidationError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
