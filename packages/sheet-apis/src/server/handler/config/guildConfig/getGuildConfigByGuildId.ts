import { GuildConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);
export const getGuildConfigByGuildIdHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("guildConfig.getGuildConfigByGuildId"),
  Handler.Config.Builder.requestParams({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
