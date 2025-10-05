import { getEventConfigHandlerConfig } from "@/server/handler/config";
import { EventConfig } from "@/server/schema";
import { AuthService, SheetService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getEventConfigHandler = pipe(
  builders.empty(),
  builders.data(getEventConfigHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getEventConfigHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          SheetService.ofGuild(guildId),
          Effect.flatMap((layer) =>
            pipe(
              SheetService.getEventConfig(),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(Schema.encodeEither(EventConfig)),
      Effect.withSpan("getEventConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
