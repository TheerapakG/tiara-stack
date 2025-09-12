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
export const upsertGuildChannelConfigHandlerConfig =
  defineHandlerConfigBuilder()
    .name("guildConfig.upsertGuildChannelConfig")
    .type("mutation")
    .request({
      validator: pipe(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.String,
          name: Schema.optional(Schema.NullishOr(Schema.String)),
          running: Schema.optional(Schema.Boolean),
          roleId: Schema.optional(Schema.NullishOr(Schema.String)),
          checkinChannelId: Schema.optional(Schema.NullishOr(Schema.String)),
        }),
        Schema.standardSchemaV1,
      ),
      validate: true,
    })
    .response({
      validator: pipe(responseSchema, Schema.standardSchemaV1),
    })
    .build();

export const upsertGuildChannelConfigHandler = defineHandlerBuilder()
  .config(upsertGuildChannelConfigHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(
            upsertGuildChannelConfigHandlerConfig,
          ).request.parsed(),
          Effect.flatMap(observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.upsertGuildChannelConfig(
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
      Effect.withSpan("upsertGuildChannelConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  );
