import { Error, ZeroGuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { ResultSchema } from "typhoon-core/schema";

export const getZeroGuildRunningChannelByNameHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("guildConfig.getZeroGuildRunningChannelByName"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        channelName: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      ResultSchema({
        optimistic: Schema.Either({
          right: ZeroGuildChannelConfig,
          left: Error.Core.ArgumentError,
        }),
        complete: Schema.Either({
          right: ZeroGuildChannelConfig,
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
        Error.Core.ZeroQueryErrorSchema,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
