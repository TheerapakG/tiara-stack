import { defineQuery } from "@rocicorp/zero";
import { Schema, pipe } from "effect";
import { builder } from "../schema";

export const guildConfig = {
  getAutoCheckinGuilds: defineQuery(pipe(Schema.Struct({}), Schema.standardSchemaV1), () =>
    builder.configGuild.where("autoCheckin", "=", true).where("deletedAt", "IS", null),
  ),
  getGuildConfigByGuildId: defineQuery(
    pipe(Schema.Struct({ guildId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { guildId } }) =>
      builder.configGuild.where("guildId", "=", guildId).where("deletedAt", "IS", null).one(),
  ),
};
