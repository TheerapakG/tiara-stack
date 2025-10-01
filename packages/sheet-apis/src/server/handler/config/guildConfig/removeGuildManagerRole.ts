import { GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const responseSchema = Schema.Array(GuildConfigManagerRole);
export const removeGuildManagerRoleHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("guildConfig.removeGuildManagerRole"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
