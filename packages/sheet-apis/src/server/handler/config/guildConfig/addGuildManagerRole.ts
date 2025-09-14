import { GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";

const responseSchema = Schema.OptionFromNullishOr(
  GuildConfigManagerRole,
  undefined,
);
export const addGuildManagerRoleHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.addGuildManagerRole")
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
