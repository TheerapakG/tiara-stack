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
        scriptId: "scriptId" in args ? (args.scriptId ?? null) : undefined,
        sheetId: "sheetId" in args ? (args.sheetId ?? null) : undefined,
        autoCheckin: "autoCheckin" in args ? (args.autoCheckin ?? false) : undefined,
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
        running: Schema.optionalWith(Schema.Boolean, { nullable: true }),
        roleId: Schema.optionalWith(Schema.String, { nullable: true }),
        checkinChannelId: Schema.optionalWith(Schema.String, { nullable: true }),
      }),
      Schema.standardSchemaV1,
    ),
    async ({ tx, args }) =>
      await tx.mutate.configGuildChannel.upsert({
        guildId: args.guildId,
        channelId: args.channelId,
        name: "name" in args ? (args.name ?? null) : undefined,
        running: "running" in args ? (args.running ?? false) : undefined,
        roleId: "roleId" in args ? (args.roleId ?? null) : undefined,
        checkinChannelId: "checkinChannelId" in args ? (args.checkinChannelId ?? null) : undefined,
        deletedAt: null,
      }),
  ),
};
