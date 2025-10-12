import { MessageRoomOrder } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const requestSchema = Schema.Struct({
  messageId: Schema.String,
  hour: Schema.Number,
  rank: Schema.Number,
});

const responseSchema = Schema.OptionFromNullishOr(MessageRoomOrder, undefined);

export const upsertMessageRoomOrderHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageRoomOrder.upsertMessageRoomOrder"),
  Handler.Config.Builder.requestParams({
    validator: pipe(requestSchema, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
