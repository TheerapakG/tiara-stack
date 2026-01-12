import { Error, GuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getGuildRunningChannelByNameHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("subscription"),
  Handler.Data.Builder.name("guildConfig.getGuildRunningChannelByName"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        channelName: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: Schema.Either({
          right: GuildChannelConfig,
          left: Schema.Union(Error.Core.ArgumentError, Error.Core.ZeroQueryError),
        }),
        complete: Schema.Either({
          right: GuildChannelConfig,
          left: Schema.Union(Error.Core.ArgumentError, Error.Core.ZeroQueryError),
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
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
