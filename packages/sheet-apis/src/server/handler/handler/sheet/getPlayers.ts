import { getPlayersHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getPlayersHandler = pipe(
  builders.empty(),
  builders.data(getPlayersHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getPlayersHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.SheetService.getPlayers(),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getPlayersHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getPlayersHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
