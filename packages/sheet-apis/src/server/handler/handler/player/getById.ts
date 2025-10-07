import { getByIdHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getByIdHandler = pipe(
  builders.empty(),
  builders.data(getByIdHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getByIdHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, ids }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              ids,
              Effect.forEach(Sheet.PlayerService.getById, {
                concurrency: "unbounded",
              }),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getByIdHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getByIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
