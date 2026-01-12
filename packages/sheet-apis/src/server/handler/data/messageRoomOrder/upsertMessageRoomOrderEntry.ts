import { Error, MessageRoomOrderEntry } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const upsertMessageRoomOrderEntryHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("mutation"),
  Handler.Data.Builder.name("messageRoomOrder.upsertMessageRoomOrderEntry"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        messageId: Schema.String,
        hour: Schema.Number,
        entries: Schema.Array(
          Schema.Struct({
            hour: Schema.Number,
            rank: Schema.Number,
            position: Schema.Number,
            team: Schema.String,
            tags: Schema.Array(Schema.String),
            effectValue: Schema.Number,
          }),
        ),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(Schema.Array(MessageRoomOrderEntry), Schema.standardSchemaV1),
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
