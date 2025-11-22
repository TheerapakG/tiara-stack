import { Error, GuildConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getGuildConfigByGuildIdHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("guildConfig.getGuildConfigByGuildId"),
  Handler.Config.Builder.requestParams({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: Schema.Either({
          right: GuildConfig,
          left: Error.Core.ArgumentError,
        }),
        complete: Schema.Either({
          right: GuildConfig,
          left: Error.Core.ArgumentError,
        }),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.responseError({
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
