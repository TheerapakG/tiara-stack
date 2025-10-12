import { MessageRoomOrderEntry } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const itemSchema = Schema.Struct({
  hour: Schema.Number,
  rank: Schema.Number,
  position: Schema.Number,
  team: Schema.String,
  tags: Schema.Array(Schema.String),
});

const requestSchema = Schema.Struct({
  messageId: Schema.String,
  hour: Schema.Number,
  entries: Schema.Array(itemSchema),
});

const responseSchema = Schema.Array(MessageRoomOrderEntry);

export const upsertMessageRoomOrderEntryHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageRoomOrder.upsertMessageRoomOrderEntry"),
  Handler.Config.Builder.requestParams({
    validator: pipe(requestSchema, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
