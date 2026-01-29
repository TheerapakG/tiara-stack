import { defineMutator } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { builder, Schema as ZeroSchema } from "../schema";

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: ZeroSchema;
  }
}

export const messageRoomOrder = {
  decrementMessageRoomOrderRank: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) => {
      const messageRoomOrder = await tx.run(
        builder.messageRoomOrder
          .where("messageId", "=", args.messageId)
          .where("deletedAt", "IS", null)
          .one(),
      );
      if (!messageRoomOrder) return;
      await tx.mutate.messageRoomOrder.update({
        messageId: args.messageId,
        rank: messageRoomOrder.rank - 1,
      });
    },
  ),
  incrementMessageRoomOrderRank: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) => {
      const messageRoomOrder = await tx.run(
        builder.messageRoomOrder
          .where("messageId", "=", args.messageId)
          .where("deletedAt", "IS", null)
          .one(),
      );
      if (!messageRoomOrder) return;
      await tx.mutate.messageRoomOrder.update({
        messageId: args.messageId,
        rank: messageRoomOrder.rank + 1,
      });
    },
  ),
  upsertMessageRoomOrder: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        previousFills: Schema.Array(Schema.String),
        fills: Schema.Array(Schema.String),
        hour: Schema.Number,
        rank: Schema.Number,
        monitor: Schema.optionalWith(Schema.String, { nullable: true }),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.messageRoomOrder.upsert({
        messageId: args.messageId,
        previousFills: args.previousFills.slice(),
        fills: args.fills.slice(),
        hour: args.hour,
        rank: args.rank,
        monitor: args.monitor ?? null,
        deletedAt: null,
      }),
  ),
  upsertMessageRoomOrderEntry: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        entries: Schema.Array(
          Schema.Struct({
            rank: Schema.Number,
            position: Schema.Number,
            hour: Schema.Number,
            team: Schema.String,
            tags: Schema.Array(Schema.String),
            effectValue: Schema.Number,
          }),
        ),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) => {
      await Promise.all(
        args.entries.map((entry) =>
          tx.mutate.messageRoomOrderEntry.upsert({
            messageId: args.messageId,
            rank: entry.rank,
            position: entry.position,
            hour: entry.hour,
            team: entry.team,
            tags: entry.tags.slice(),
            effectValue: entry.effectValue,
            deletedAt: null,
          }),
        ),
      );
    },
  ),
  removeMessageRoomOrderEntry: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        rank: Schema.Number,
        position: Schema.Number,
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.messageRoomOrderEntry.update({
        messageId: args.messageId,
        rank: args.rank,
        position: args.position,
        deletedAt: Date.now() / 1000,
      }),
  ),
};
