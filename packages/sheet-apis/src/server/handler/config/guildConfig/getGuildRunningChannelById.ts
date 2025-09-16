import { GuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { HandlerConfig } from "typhoon-core/config";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);
export const getGuildRunningChannelByIdHandlerConfig = pipe(
  HandlerConfig.empty,
  HandlerConfig.Builder.name("guildConfig.getGuildRunningChannelById"),
  HandlerConfig.Builder.type("subscription"),
  HandlerConfig.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  HandlerConfig.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
