import { getEventConfigHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema, Scope } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getEventConfigHandler = pipe(
  builders.empty(),
  builders.data(getEventConfigHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getEventConfigHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed: { guildId }, scope }) =>
        pipe(
          Effect.log("getting layer of guild id"),
          Effect.andThen(Sheet.layerOfGuildId(guildId)),
          Computed.tap(() => Effect.log("getting event config")),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.SheetService.getEventConfig(),
              Computed.make,
              Computed.provideLayerComputedResult(layer),
            ),
          ),
          Effect.tap(() =>
            Effect.addFinalizer(() => Effect.log("finalizing event config")),
          ),
          Scope.extend(scope),
        ),
      ),
      Computed.tap((eventConfig) => Effect.log(eventConfig)),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getEventConfigHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getEventConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
