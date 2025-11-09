import { getScheduleConfigHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getScheduleConfigHandler = pipe(
  builders.empty(),
  builders.data(getScheduleConfigHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getScheduleConfigHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.SheetService.getScheduleConfig(),
              Computed.make,
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getScheduleConfigHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getScheduleConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
