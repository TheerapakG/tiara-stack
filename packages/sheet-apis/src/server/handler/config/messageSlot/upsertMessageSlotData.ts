import { Error, MessageSlot } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const upsertMessageSlotDataHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageSlot.upsertMessageSlotData"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        messageId: Schema.String,
        day: Schema.Number,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(MessageSlot, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.responseError({
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
