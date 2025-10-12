import { MessageCheckinMember } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const requestSchema = Schema.Struct({
  messageId: Schema.String,
  memberIds: Schema.Array(Schema.String),
});

const responseSchema = Schema.Array(MessageCheckinMember);

export const addMessageCheckinMembersHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageCheckin.addMessageCheckinMembers"),
  Handler.Config.Builder.requestParams({
    validator: pipe(requestSchema, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
