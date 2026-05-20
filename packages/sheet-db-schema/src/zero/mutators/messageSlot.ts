import { defineMutator } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { builder, type Schema as ZeroSchema } from "../schema";

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: ZeroSchema;
  }
}

const withUpsertTimestamps = <const Value extends Record<string, unknown> & { createdAt?: number }>(
  value: Value,
  existingCreatedAt?: number,
) => {
  const now = Date.now();
  return {
    ...value,
    createdAt: value.createdAt ?? existingCreatedAt ?? now,
    updatedAt: now,
  };
};

export const messageSlot = {
  upsertMessageSlotData: defineMutator(
    pipe(
      Schema.Struct({
        messageId: Schema.String,
        day: Schema.Number,
        guildId: Schema.NullOr(Schema.String),
        messageChannelId: Schema.NullOr(Schema.String),
        createdByUserId: Schema.NullOr(Schema.String),
      }),
      Schema.toStandardSchemaV1,
    ),
    async ({ tx, args }) => {
      const existingSlot = await tx.run(
        builder.messageSlot.where("messageId", "=", args.messageId).one(),
      );

      await tx.mutate.messageSlot.upsert(
        withUpsertTimestamps(
          {
            messageId: args.messageId,
            day: args.day,
            guildId: args.guildId,
            messageChannelId: args.messageChannelId,
            createdByUserId: args.createdByUserId,
            deletedAt: null,
          },
          existingSlot?.createdAt,
        ),
      );
    },
  ),
};
