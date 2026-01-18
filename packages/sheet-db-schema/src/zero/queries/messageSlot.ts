import { defineQuery } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { builder } from "../schema";

export const messageSlot = {
  getMessageSlotData: defineQuery(
    pipe(Schema.Struct({ messageId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { messageId } }) =>
      builder.messageSlot.where("messageId", "=", messageId).where("deletedAt", "IS", null).one(),
  ),
};
