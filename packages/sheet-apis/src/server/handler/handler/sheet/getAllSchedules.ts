import { getAllSchedulesHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema, Scope } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getAllSchedulesHandler = pipe(
  builders.empty(),
  builders.data(getAllSchedulesHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getAllSchedulesHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed: { guildId }, scope }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.SheetService.getAllSchedules(),
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
            Handler.Config.response(getAllSchedulesHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getAllSchedulesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
