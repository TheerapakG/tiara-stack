import { Effect, pipe, Schema } from "effect";
import { observeOnce } from "typhoon-core/signal";
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
export const setGuildChannelConfigHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.setGuildChannelConfig")
  .type("mutation")
  .request({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.String,
        name: Schema.optional(Schema.String),
        running: Schema.optional(Schema.Boolean),
        roleId: Schema.optional(Schema.String),
        checkinChannelId: Schema.optional(Schema.String),
      }),
      Schema.standardSchemaV1,
    ),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();

export const setGuildChannelConfigHandler = defineHandlerBuilder()
  .config(setGuildChannelConfigHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(setGuildChannelConfigHandlerConfig).request.parsed(),
          Effect.flatMap(observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.setGuildChannelConfig(
          parsed.guildId,
          parsed.channelId,
          {
            name: parsed.name,
            running: parsed.running,
            roleId: parsed.roleId,
            checkinChannelId: parsed.checkinChannelId,
          },
        ),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("setGuildChannelConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  );
