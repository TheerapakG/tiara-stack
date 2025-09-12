import { Effect, pipe, Schema } from "effect";
import { observeOnce } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import {
  AuthService,
  GuildConfig,
  GuildConfigService,
} from "../../../services";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);
export const upsertGuildConfigHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.upsertGuildConfig")
  .type("mutation")
  .request({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        scriptId: Schema.optional(Schema.NullishOr(Schema.String)),
        sheetId: Schema.optional(Schema.NullishOr(Schema.String)),
      }),
      Schema.standardSchemaV1,
    ),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();

export const upsertGuildConfigHandler = defineHandlerBuilder()
  .config(upsertGuildConfigHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(upsertGuildConfigHandlerConfig).request.parsed(),
          Effect.flatMap(observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.upsertGuildConfig(parsed.guildId, parsed),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("upsertGuildConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  );
