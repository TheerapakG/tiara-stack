import { getDaySchedulesHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema, Scope } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getDaySchedulesHandler = pipe(
  builders.empty(),
  builders.data(getDaySchedulesHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getDaySchedulesHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed: { guildId, day }, scope }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.SheetService.getDaySchedules(day),
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
            Handler.Config.response(getDaySchedulesHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getDaySchedulesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
