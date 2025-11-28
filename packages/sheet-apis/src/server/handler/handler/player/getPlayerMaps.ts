import { getPlayerMapsHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, flow, pipe, Schema, Scope } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getPlayerMapsHandler = pipe(
  builders.empty(),
  builders.data(getPlayerMapsHandlerConfig),
  builders.handler(
    pipe(
      Effect.succeed(Event.someToken()),
      Effect.map(Effect.flatMap(AuthService.verify)),
      Effect.map(
        flow(
          Effect.flatMap(() =>
            Event.request.parsedWithScope(getPlayerMapsHandlerConfig),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        flow(
          Effect.flatMap(({ parsed: { guildId }, scope }) =>
            pipe(
              Sheet.layerOfGuildId(guildId),
              Effect.flatMap((layer) =>
                pipe(
                  Effect.all({
                    signal: Effect.succeed(Sheet.PlayerService.getPlayerMaps()),
                    layer,
                  }),
                  Effect.map(({ signal, layer }) =>
                    pipe(
                      layer,
                      Result.match({
                        onOptimistic: (l) =>
                          pipe(
                            signal,
                            Effect.map(Result.optimistic),
                            Effect.provide(l),
                          ),
                        onComplete: (l) =>
                          pipe(
                            signal,
                            Effect.map(Result.complete),
                            Effect.provide(l),
                          ),
                      }),
                    ),
                  ),
                ),
              ),
              Scope.extend(scope),
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        Effect.flatMap(
          Schema.encodeEither(
            Handler.Config.resolveResponseValidator(
              Handler.Config.response(getPlayerMapsHandlerConfig),
            ),
          ),
        ),
      ),
      Effect.withSpan("getPlayerMapsHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
