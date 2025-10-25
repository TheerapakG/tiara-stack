import { getPlayerMapsHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Computed, Signal } from "typhoon-core/signal";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getPlayerMapsHandler = pipe(
  builders.empty(),
  builders.data(getPlayerMapsHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getPlayerMapsHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.PlayerService.getPlayerMaps(),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getPlayerMapsHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getPlayerMapsHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
