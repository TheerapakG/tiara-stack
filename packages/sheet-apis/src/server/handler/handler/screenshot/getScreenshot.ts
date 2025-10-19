import { getScreenshotHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getScreenshotHandler = pipe(
  builders.empty(),
  builders.data(getScreenshotHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getScreenshotHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, channel, day }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.ScreenshotService.getScreenshot(channel, day),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getScreenshotHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getDaySchedulesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
