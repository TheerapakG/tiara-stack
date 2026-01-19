import { defineQuery } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { builder } from "../schema";

export const messageRoomOrder = {
  getMessageRoomOrder: defineQuery(
    pipe(Schema.Struct({ messageId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { messageId } }) =>
      builder.messageRoomOrder
        .where("messageId", "=", messageId)
        .where("deletedAt", "IS", null)
        .one(),
  ),
  getMessageRoomOrderEntry: defineQuery(
    pipe(Schema.Struct({ messageId: Schema.String, rank: Schema.Number }), Schema.standardSchemaV1),
    ({ args: { messageId, rank } }) =>
      builder.messageRoomOrderEntry
        .where("messageId", "=", messageId)
        .where("rank", "=", rank)
        .where("deletedAt", "IS", null)
        .orderBy("position", "asc"),
  ),
  getMessageRoomOrderRange: defineQuery(
    pipe(Schema.Struct({ messageId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { messageId } }) =>
      builder.messageRoomOrderEntry
        .where("messageId", "=", messageId)
        .where("deletedAt", "IS", null),
  ),
};
