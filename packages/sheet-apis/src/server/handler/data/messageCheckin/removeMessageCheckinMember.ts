import { Error, MessageCheckinMember } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const removeMessageCheckinMemberHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("mutation"),
  Handler.Data.Builder.name("messageCheckin.removeMessageCheckinMember"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        messageId: Schema.String,
        memberId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(MessageCheckinMember, Schema.standardSchemaV1),
  }),
  Handler.Data.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.ArgumentError,
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
