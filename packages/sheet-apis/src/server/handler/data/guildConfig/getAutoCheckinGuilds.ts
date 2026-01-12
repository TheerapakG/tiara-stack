import { Error, GuildConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getAutoCheckinGuildsHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("subscription"),
  Handler.Data.Builder.name("guildConfig.getAutoCheckinGuilds"),
  Handler.Data.Builder.requestParams({
    validator: pipe(Schema.Struct({}), Schema.standardSchemaV1),
  }),
  Handler.Data.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: Schema.Either({
          right: Schema.Array(GuildConfig),
          left: Error.Core.ZeroQueryError,
        }),
        complete: Schema.Either({
          right: Schema.Array(GuildConfig),
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
