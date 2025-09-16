import { GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { HandlerConfig } from "typhoon-core/config";

const responseSchema = Schema.Array(GuildConfigManagerRole);
export const getGuildManagerRolesHandlerConfig = pipe(
  HandlerConfig.empty,
  HandlerConfig.Builder.name("guildConfig.getGuildManagerRoles"),
  HandlerConfig.Builder.type("subscription"),
  HandlerConfig.Builder.requestParams({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
  }),
  HandlerConfig.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
