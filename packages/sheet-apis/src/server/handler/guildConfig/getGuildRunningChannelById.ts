import { Effect, Function, pipe, Schema } from "effect";
import { computed, Computed } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import {
  AuthService,
  GuildChannelConfig,
  GuildConfigService,
} from "../../../services";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);
export const getGuildRunningChannelByIdHandlerConfig =
  defineHandlerConfigBuilder()
    .name("guildConfig.getGuildRunningChannelById")
    .type("subscription")
    .request({
      validator: pipe(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.String,
        }),
        Schema.standardSchemaV1,
      ),
      validate: true,
    })
    .response({
      validator: pipe(responseSchema, Schema.standardSchemaV1),
    })
    .build();

export const getGuildRunningChannelByIdHandler = defineHandlerBuilder()
  .config(getGuildRunningChannelByIdHandlerConfig)
  .handler(
    pipe(
      computed(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.withConfig(
          getGuildRunningChannelByIdHandlerConfig,
        ).request.parsed(),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildRunningChannelById(
          parsed.guildId,
          parsed.channelId,
        ),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("getGuildRunningChannelByIdHandler", {
        captureStackTrace: true,
      }),
    ),
  );
