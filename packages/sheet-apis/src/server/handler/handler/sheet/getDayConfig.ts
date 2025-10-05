import { getDayConfigHandlerConfig } from "@/server/handler/config";
import { DayConfig } from "@/server/schema";
import { AuthService, SheetService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getDayConfigHandler = pipe(
  builders.empty(),
  builders.data(getDayConfigHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getDayConfigHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          SheetService.ofGuild(guildId),
          Effect.flatMap((layer) =>
            pipe(
              SheetService.getDayConfig(),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(Schema.encodeEither(Schema.Array(DayConfig))),
      Effect.withSpan("getDayConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
