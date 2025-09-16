import { GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { HandlerConfig } from "typhoon-core/config";

const responseSchema = Schema.OptionFromNullishOr(
  GuildConfigManagerRole,
  undefined,
);
export const addGuildManagerRoleHandlerConfig = pipe(
  HandlerConfig.empty,
  HandlerConfig.Builder.name("guildConfig.addGuildManagerRole"),
  HandlerConfig.Builder.type("mutation"),
  HandlerConfig.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  HandlerConfig.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
