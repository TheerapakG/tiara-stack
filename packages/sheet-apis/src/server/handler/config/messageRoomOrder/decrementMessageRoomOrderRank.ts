import { MessageRoomOrder } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const requestSchema = Schema.Struct({
  messageId: Schema.String,
});

const responseSchema = Schema.OptionFromNullishOr(MessageRoomOrder, undefined);

export const decrementMessageRoomOrderRankHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageRoomOrder.decrementMessageRoomOrderRank"),
  Handler.Config.Builder.requestParams({
    validator: pipe(requestSchema, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
