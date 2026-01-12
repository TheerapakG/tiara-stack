import { Error, GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const removeGuildManagerRoleHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("mutation"),
  Handler.Data.Builder.name("guildConfig.removeGuildManagerRole"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(GuildConfigManagerRole, Schema.standardSchemaV1),
  }),
  Handler.Data.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.ArgumentError,
        Error.Core.AuthorizationError,
        Error.Core.DBQueryError,
        Error.Core.MsgpackDecodeError,
        Error.Core.StreamExhaustedError,
        Error.Core.ValidationError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
