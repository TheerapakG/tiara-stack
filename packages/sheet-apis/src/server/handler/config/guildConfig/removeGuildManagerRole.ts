import { GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";

const responseSchema = Schema.Array(GuildConfigManagerRole);
export const removeGuildManagerRoleHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.removeGuildManagerRole")
  .type("mutation")
  .request({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();
