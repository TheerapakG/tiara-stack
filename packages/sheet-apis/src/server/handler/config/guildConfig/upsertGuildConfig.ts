import { GuildConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);
export const upsertGuildConfigHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.upsertGuildConfig")
  .type("mutation")
  .request({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        scriptId: Schema.optional(Schema.NullishOr(Schema.String)),
        sheetId: Schema.optional(Schema.NullishOr(Schema.String)),
      }),
      Schema.standardSchemaV1,
    ),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();
