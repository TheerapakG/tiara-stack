import { defineMutator } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { builder, type Schema as ZeroSchema } from "../schema";
import { preserveOmitted } from "../timestamps";

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

export const guildConfig = {
  upsertGuildConfig: defineMutator(
    pipe(
      Schema.Struct({
        guildId: Schema.String,
        sheetId: Schema.optional(Schema.NullOr(Schema.String)),
        autoCheckin: Schema.optional(Schema.NullOr(Schema.Boolean)),
      }),
      Schema.toStandardSchemaV1,
    ),
    async ({ tx, args }) => {
      const existingConfigGuild = await tx.run(
        builder.configGuild.where("guildId", "=", args.guildId).one(),
      );

      await tx.mutate.configGuild.upsert(
        withUpsertTimestamps(
          {
            guildId: args.guildId,
            sheetId: preserveOmitted(args.sheetId, existingConfigGuild?.sheetId),
            autoCheckin: preserveOmitted(args.autoCheckin, existingConfigGuild?.autoCheckin),
            deletedAt: null,
          },
          existingConfigGuild?.createdAt,
        ),
      );
    },
  ),
  addGuildMonitorRole: defineMutator(
    pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.toStandardSchemaV1,
    ),
    async ({ tx, args }) => {
      const existingRole = await tx.run(
        builder.configGuildManagerRole
          .where("guildId", "=", args.guildId)
          .where("roleId", "=", args.roleId)
          .one(),
      );

      await tx.mutate.configGuildManagerRole.upsert(
        withUpsertTimestamps(
          {
            guildId: args.guildId,
            roleId: args.roleId,
            deletedAt: null,
          },
          existingRole?.createdAt,
        ),
      );
    },
  ),
  removeGuildMonitorRole: defineMutator(
    pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.toStandardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.configGuildManagerRole.update({
        guildId: args.guildId,
        roleId: args.roleId,
        deletedAt: Date.now() / 1000,
      }),
  ),
  upsertGuildChannelConfig: defineMutator(
    pipe(
      Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.String,
        name: Schema.optional(Schema.NullOr(Schema.String)),
        running: Schema.optional(Schema.NullOr(Schema.Boolean)),
        roleId: Schema.optional(Schema.NullOr(Schema.String)),
        checkinChannelId: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      Schema.toStandardSchemaV1,
    ),
    async ({ tx, args }) => {
      const existingChannel = await tx.run(
        builder.configGuildChannel
          .where("guildId", "=", args.guildId)
          .where("channelId", "=", args.channelId)
          .one(),
      );

      await tx.mutate.configGuildChannel.upsert(
        withUpsertTimestamps(
          {
            guildId: args.guildId,
            channelId: args.channelId,
            name: preserveOmitted(args.name, existingChannel?.name),
            running: preserveOmitted(args.running, existingChannel?.running),
            roleId: preserveOmitted(args.roleId, existingChannel?.roleId),
            checkinChannelId: preserveOmitted(
              args.checkinChannelId,
              existingChannel?.checkinChannelId,
            ),
            deletedAt: null,
          },
          existingChannel?.createdAt,
        ),
      );
    },
  ),
};
