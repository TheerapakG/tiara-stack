import { GuildConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);
export const getGuildConfigByScriptIdHandlerConfig =
  defineHandlerConfigBuilder()
    .name("guildConfig.getGuildConfigByScriptId")
    .type("subscription")
    .request({
      validator: pipe(Schema.String, Schema.standardSchemaV1),
      validate: true,
    })
    .response({
      validator: pipe(responseSchema, Schema.standardSchemaV1),
    })
    .build();
