import { defineQuery } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { builder } from "../schema";

export const messageCheckin = {
  getMessageCheckinData: defineQuery(
    pipe(Schema.Struct({ messageId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { messageId } }) =>
      builder.messageCheckin
        .where("messageId", "=", messageId)
        .where("deletedAt", "IS", null)
        .one(),
  ),
  getMessageCheckinMembers: defineQuery(
    pipe(Schema.Struct({ messageId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { messageId } }) =>
      builder.messageCheckinMember
        .where("messageId", "=", messageId)
        .where("deletedAt", "IS", null),
  ),
};
