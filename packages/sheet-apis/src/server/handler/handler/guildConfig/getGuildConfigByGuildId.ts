import { getGuildConfigByGuildIdHandlerConfig } from "@/server/handler/config";
import { GuildConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Computed } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);

export const getGuildConfigByGuildIdHandler = defineHandlerBuilder()
  .config(getGuildConfigByGuildIdHandlerConfig)
  .handler(
    pipe(
      Computed.make(Event.token()),
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
