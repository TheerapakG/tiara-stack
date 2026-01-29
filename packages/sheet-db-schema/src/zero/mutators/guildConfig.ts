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
        scriptId: Schema.optionalWith(Schema.String, { nullable: true }),
        sheetId: Schema.optionalWith(Schema.String, { nullable: true }),
        autoCheckin: Schema.optionalWith(Schema.Boolean, { nullable: true }),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.configGuild.upsert({
        guildId: args.guildId,
        scriptId: args.scriptId,
        sheetId: args.sheetId,
        autoCheckin: args.autoCheckin ?? false,
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
        name: Schema.optionalWith(Schema.String, { nullable: true }),
        running: Schema.Boolean,
        roleId: Schema.optionalWith(Schema.String, { nullable: true }),
        checkinChannelId: Schema.optionalWith(Schema.String, { nullable: true }),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.configGuildChannel.upsert({
        guildId: args.guildId,
        channelId: args.channelId,
        name: args.name ?? null,
        running: args.running,
        roleId: args.roleId ?? null,
        checkinChannelId: args.checkinChannelId ?? null,
        deletedAt: null,
      }),
  ),
};
