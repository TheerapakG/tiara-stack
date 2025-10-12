import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { MessageRoomOrderEntry } from "@/server/schema";

const requestSchema = Schema.Struct({
  messageId: Schema.String,
});

const responseSchema = Schema.Array(MessageRoomOrderEntry);

export const removeMessageRoomOrderEntryHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageRoomOrder.removeMessageRoomOrderEntry"),
  Handler.Config.Builder.requestParams({
    validator: pipe(requestSchema, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
