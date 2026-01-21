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
  getGuildConfigByScriptId: defineQuery(
    pipe(Schema.Struct({ scriptId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { scriptId } }) =>
      builder.configGuild.where("scriptId", "=", scriptId).where("deletedAt", "IS", null).one(),
  ),
  getGuildManagerRoles: defineQuery(
    pipe(Schema.Struct({ guildId: Schema.String }), Schema.standardSchemaV1),
    ({ args: { guildId } }) =>
      builder.configGuildManagerRole.where("guildId", "=", guildId).where("deletedAt", "IS", null),
  ),
  getGuildRunningChannelById: defineQuery(
    pipe(
      Schema.Struct({ guildId: Schema.String, channelId: Schema.String }),
      Schema.standardSchemaV1,
    ),
    ({ args: { guildId, channelId } }) =>
      builder.configGuildChannel
        .where("guildId", "=", guildId)
        .where("channelId", "=", channelId)
        .where("deletedAt", "IS", null)
        .one(),
  ),
  getGuildRunningChannelByName: defineQuery(
    pipe(
      Schema.Struct({ guildId: Schema.String, channelName: Schema.String }),
      Schema.standardSchemaV1,
    ),
    ({ args: { guildId, channelName } }) =>
      builder.configGuildChannel
        .where("guildId", "=", guildId)
        .where("name", "=", channelName)
        .where("deletedAt", "IS", null)
        .one(),
  ),
};
