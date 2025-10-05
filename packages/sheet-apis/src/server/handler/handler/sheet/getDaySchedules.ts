import { getDaySchedulesHandlerConfig } from "@/server/handler/config";
import { Schedule } from "@/server/schema";
import { AuthService, SheetService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getDaySchedulesHandler = pipe(
  builders.empty(),
  builders.data(getDaySchedulesHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getDaySchedulesHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, day }) =>
        pipe(
          SheetService.ofGuild(guildId),
          Effect.flatMap((layer) =>
            pipe(
              SheetService.getDaySchedules(day),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Schema.HashMap({
            key: Schema.Number,
            value: Schedule,
          }),
        ),
      ),
      Effect.withSpan("getDaySchedulesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
