import { Error, MessageCheckin } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const upsertMessageCheckinDataHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("mutation"),
  Handler.Data.Builder.name("messageCheckin.upsertMessageCheckinData"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        messageId: Schema.String,
        initialMessage: Schema.String,
        hour: Schema.Number,
        channelId: Schema.String,
        roleId: Schema.optional(Schema.NullishOr(Schema.String)),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(MessageCheckin, Schema.standardSchemaV1),
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
