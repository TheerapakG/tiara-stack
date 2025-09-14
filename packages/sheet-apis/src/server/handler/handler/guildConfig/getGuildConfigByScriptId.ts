import { getGuildConfigByScriptIdHandlerConfig } from "@/server/handler/config";
import { GuildConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { computed, Computed } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);

export const getGuildConfigByScriptIdHandler = defineHandlerBuilder()
  .config(getGuildConfigByScriptIdHandlerConfig)
  .handler(
    pipe(
      computed(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.withConfig(
          getGuildConfigByScriptIdHandlerConfig,
        ).request.parsed(),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildConfigByScriptId(parsed),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("getGuildConfigByScriptIdHandler", {
        captureStackTrace: true,
      }),
    ),
  );
