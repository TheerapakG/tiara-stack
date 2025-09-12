import { Effect, Function, pipe, Schema } from "effect";
import { computed, Computed } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import {
  AuthService,
  GuildConfig,
  GuildConfigService,
} from "../../../services";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);
export const getGuildConfigByGuildIdHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.getGuildConfigByGuildId")
  .type("subscription")
  .request({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();

export const getGuildConfigByGuildIdHandler = defineHandlerBuilder()
  .config(getGuildConfigByGuildIdHandlerConfig)
  .handler(
    pipe(
      computed(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.withConfig(getGuildConfigByGuildIdHandlerConfig).request.parsed(),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildConfigByGuildId(parsed),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("getGuildConfigByGuildIdHandler", {
        captureStackTrace: true,
      }),
    ),
  );
