import { getGuildConfigByScriptIdHandlerConfig } from "@/server/handler/config";
import { GuildConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);

export const getGuildConfigByScriptIdHandler = pipe(
  HandlerContextConfig.empty,
  HandlerContextConfig.Builder.config(getGuildConfigByScriptIdHandlerConfig),
  HandlerContextConfig.Builder.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildConfigByScriptIdHandlerConfig),
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
  ),
);
