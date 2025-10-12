import { MessageCheckin } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const requestSchema = Schema.Struct({
  messageId: Schema.String,
  initialMessage: Schema.String,
  hour: Schema.Number,
  channelId: Schema.String,
  roleId: Schema.optional(Schema.NullishOr(Schema.String)),
});

const responseSchema = Schema.OptionFromNullishOr(MessageCheckin, undefined);

export const upsertMessageCheckinDataHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageCheckin.upsertMessageCheckinData"),
  Handler.Config.Builder.requestParams({
    validator: pipe(requestSchema, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
