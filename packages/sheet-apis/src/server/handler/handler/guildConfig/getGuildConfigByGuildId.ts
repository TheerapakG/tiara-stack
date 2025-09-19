import { getGuildConfigByGuildIdHandlerConfig } from "@/server/handler/config";
import { GuildConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);

export const getGuildConfigByGuildIdHandler = pipe(
  HandlerContextConfig.empty,
  HandlerContextConfig.Builder.config(getGuildConfigByGuildIdHandlerConfig),
  HandlerContextConfig.Builder.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildConfigByGuildIdHandlerConfig),
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
  ),
);
