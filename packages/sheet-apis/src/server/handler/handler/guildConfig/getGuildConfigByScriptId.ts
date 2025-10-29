import { getGuildConfigByScriptIdHandlerConfig } from "@/server/handler/config";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Option, pipe, Schema } from "effect";
import { Argument } from "typhoon-core/error";
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
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildConfigByScriptIdHandlerConfig),
      ),
      Computed.flatMapComputed((parsed) =>
        GuildConfigService.getGuildConfigByScriptId(parsed),
      ),
      Computed.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              new Argument.ArgumentError({
                message: "No such guild config, script might not be registered",
              }),
            ),
        }),
      ),
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
