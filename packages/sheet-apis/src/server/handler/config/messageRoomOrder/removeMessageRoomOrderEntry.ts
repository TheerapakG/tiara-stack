import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { MessageRoomOrderEntry } from "@/server/schema";

export const removeMessageRoomOrderEntryHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("messageRoomOrder.removeMessageRoomOrderEntry"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        messageId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Schema.Array(MessageRoomOrderEntry),
      Schema.standardSchemaV1,
    ),
  }),
);
