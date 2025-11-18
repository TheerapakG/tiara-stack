import { Core, Error, ZeroGuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const getZeroGuildRunningChannelByIdHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("guildConfig.getZeroGuildRunningChannelById"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Core.ResultSchema(
        Schema.Either({
          right: ZeroGuildChannelConfig,
          left: Error.Core.ArgumentError,
        }),
      ),
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
