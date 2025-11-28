import { getEventConfigHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, flow, pipe, Schema, Scope } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getEventConfigHandler = pipe(
  builders.empty(),
  builders.data(getEventConfigHandlerConfig),
  builders.handler(
    pipe(
      Effect.succeed(Event.someToken()),
      Effect.map(Effect.flatMap(AuthService.verify)),
      Effect.map(
        flow(
          Effect.flatMap(() =>
            Event.request.parsedWithScope(getEventConfigHandlerConfig),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        flow(
          Effect.flatMap(({ parsed: { guildId }, scope }) =>
            pipe(
              Effect.log("getting layer of guild id"),
              Effect.andThen(Sheet.layerOfGuildId(guildId)),
              Effect.map(Effect.tap(() => Effect.log("getting event config"))),
              Effect.flatMap((layer) =>
                pipe(
                  Effect.all({
                    signal: Effect.succeed(Sheet.SheetService.getEventConfig()),
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
              Effect.tap(() =>
                Effect.addFinalizer(() =>
                  Effect.log("finalizing event config"),
                ),
              ),
              Scope.extend(scope),
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(Effect.tap((eventConfig) => Effect.log(eventConfig))),
      Effect.map(
        Effect.flatMap(
          Schema.encodeEither(
            Handler.Config.resolveResponseValidator(
              Handler.Config.response(getEventConfigHandlerConfig),
            ),
          ),
        ),
      ),
      Effect.withSpan("getEventConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
