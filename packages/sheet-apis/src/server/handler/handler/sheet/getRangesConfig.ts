import { getRangesConfigHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema, Scope } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getRangesConfigHandler = pipe(
  builders.empty(),
  builders.data(getRangesConfigHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getRangesConfigHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed: { guildId }, scope }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.SheetService.getRangesConfig(),
              Computed.make,
              Computed.provideLayerComputedResult(layer),
            ),
          ),
          Scope.extend(scope),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getRangesConfigHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getRangesConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
