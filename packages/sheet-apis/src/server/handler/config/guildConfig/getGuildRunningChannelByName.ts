import { GuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);
export const getGuildRunningChannelByNameHandlerConfig =
  defineHandlerConfigBuilder()
    .name("guildConfig.getGuildRunningChannelByName")
    .type("subscription")
    .request({
      validator: pipe(
        Schema.Struct({
          guildId: Schema.String,
          channelName: Schema.String,
        }),
        Schema.standardSchemaV1,
      ),
      validate: true,
    })
    .response({
      validator: pipe(responseSchema, Schema.standardSchemaV1),
    })
    .build();
