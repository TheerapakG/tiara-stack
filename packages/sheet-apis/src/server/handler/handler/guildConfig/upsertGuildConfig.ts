import { upsertGuildConfigHandlerConfig } from "@/server/handler/config";
import { GuildConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { OnceObserver } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);

export const upsertGuildConfigHandler = defineHandlerBuilder()
  .config(upsertGuildConfigHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(upsertGuildConfigHandlerConfig).request.parsed(),
          Effect.flatMap(OnceObserver.observeOnce),
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
