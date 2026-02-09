import { defineMutator } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { Schema as ZeroSchema } from "../schema";

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: ZeroSchema;
  }
}

export const messageCheckin = {
  upsertMessageCheckinData: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        initialMessage: Schema.String,
        hour: Schema.Number,
        channelId: Schema.String,
        roleId: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.messageCheckin.upsert({
        messageId: args.messageId,
        initialMessage: args.initialMessage,
        hour: args.hour,
        channelId: args.channelId,
        roleId: args.roleId,
        deletedAt: null,
      }),
  ),
  addMessageCheckinMembers: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        memberIds: Schema.Array(Schema.String),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) => {
      await Promise.all(
        args.memberIds.map((memberId) =>
          tx.mutate.messageCheckinMember.upsert({
            messageId: args.messageId,
            memberId,
            checkinAt: null,
            deletedAt: null,
          }),
        ),
      );
    },
  ),
  setMessageCheckinMemberCheckinAt: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        memberId: Schema.String,
        checkinAt: Schema.Number,
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.messageCheckinMember.update({
        messageId: args.messageId,
        memberId: args.memberId,
        checkinAt: args.checkinAt,
      }),
  ),
  removeMessageCheckinMember: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        memberId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.messageCheckinMember.update({
        messageId: args.messageId,
        memberId: args.memberId,
        deletedAt: Date.now() / 1000,
      }),
  ),
};
