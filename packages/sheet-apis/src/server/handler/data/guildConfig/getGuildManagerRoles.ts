import { Error, GuildConfigManagerRole } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getGuildManagerRolesHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("subscription"),
  Handler.Data.Builder.name("guildConfig.getGuildManagerRoles"),
  Handler.Data.Builder.requestParams({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
  }),
  Handler.Data.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: Schema.Either({
          right: Schema.Array(GuildConfigManagerRole),
          left: Error.Core.ZeroQueryError,
        }),
        complete: Schema.Either({
          right: Schema.Array(GuildConfigManagerRole),
          left: Error.Core.ZeroQueryError,
        }),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.AuthorizationError,
        Error.Core.MsgpackDecodeError,
        Error.Core.StreamExhaustedError,
        Error.Core.ValidationError,
        Error.Core.ZeroQueryError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
