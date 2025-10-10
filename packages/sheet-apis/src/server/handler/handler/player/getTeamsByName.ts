import { getTeamsByNameHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getTeamsByNameHandler = pipe(
  builders.empty(),
  builders.data(getTeamsByNameHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getTeamsByNameHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, names }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Effect.forEach(names, Sheet.PlayerService.getTeamsByName, {
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
            Handler.Config.response(getTeamsByNameHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getTeamsByNameHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
