import { Error, MessageCheckinMember } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const addMessageCheckinMembersHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageCheckin.addMessageCheckinMembers"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        messageId: Schema.String,
        memberIds: Schema.Array(Schema.String),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Schema.Array(MessageCheckinMember),
      Schema.standardSchemaV1,
    ),
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
