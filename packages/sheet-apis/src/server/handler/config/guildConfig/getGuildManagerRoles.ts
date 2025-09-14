import { GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";

const responseSchema = Schema.Array(GuildConfigManagerRole);
export const getGuildManagerRolesHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.getGuildManagerRoles")
  .type("subscription")
  .request({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();
