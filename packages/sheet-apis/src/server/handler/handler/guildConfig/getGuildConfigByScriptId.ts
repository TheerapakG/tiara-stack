import { getGuildConfigByScriptIdHandlerConfig } from "@/server/handler/config";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getGuildConfigByScriptIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildConfigByScriptIdHandlerConfig),
  builders.handler(
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
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getGuildConfigByScriptIdHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getGuildConfigByScriptIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
