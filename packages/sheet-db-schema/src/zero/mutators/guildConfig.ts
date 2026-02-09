import { defineMutator } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { Schema as ZeroSchema } from "../schema";

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: ZeroSchema;
  }
}

export const guildConfig = {
  upsertGuildConfig: defineMutator(
    pipe(
      Schema.Struct({
        guildId: Schema.String,
        scriptId: Schema.optional(Schema.NullOr(Schema.String)),
        sheetId: Schema.optional(Schema.NullOr(Schema.String)),
        autoCheckin: Schema.optional(Schema.NullOr(Schema.Boolean)),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.configGuild.upsert({
        guildId: args.guildId,
        scriptId: args.scriptId,
        sheetId: args.sheetId,
        autoCheckin: args.autoCheckin,
        deletedAt: null,
      }),
  ),
  addGuildManagerRole: defineMutator(
    pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.configGuildManagerRole.upsert({
        guildId: args.guildId,
        roleId: args.roleId,
        deletedAt: null,
      }),
  ),
  removeGuildManagerRole: defineMutator(
    pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.standardSchemaV1,
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
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.configGuildChannel.upsert({
        guildId: args.guildId,
        channelId: args.channelId,
        name: args.name,
        running: args.running,
        roleId: args.roleId,
        checkinChannelId: args.checkinChannelId,
        deletedAt: null,
      }),
  ),
};
