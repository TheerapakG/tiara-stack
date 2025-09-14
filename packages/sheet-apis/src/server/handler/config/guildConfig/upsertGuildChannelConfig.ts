import { GuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);
export const upsertGuildChannelConfigHandlerConfig =
  defineHandlerConfigBuilder()
    .name("guildConfig.upsertGuildChannelConfig")
    .type("mutation")
    .request({
      validator: pipe(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.String,
          name: Schema.optional(Schema.NullishOr(Schema.String)),
          running: Schema.optional(Schema.Boolean),
          roleId: Schema.optional(Schema.NullishOr(Schema.String)),
          checkinChannelId: Schema.optional(Schema.NullishOr(Schema.String)),
        }),
        Schema.standardSchemaV1,
      ),
      validate: true,
    })
    .response({
      validator: pipe(responseSchema, Schema.standardSchemaV1),
    })
    .build();
