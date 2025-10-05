import { getAllSchedulesHandlerConfig } from "@/server/handler/config";
import { Schedule } from "@/server/schema";
import { AuthService, SheetService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getAllSchedulesHandler = pipe(
  builders.empty(),
  builders.data(getAllSchedulesHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getAllSchedulesHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          SheetService.ofGuild(guildId),
          Effect.flatMap((layer) =>
            pipe(
              SheetService.getAllSchedules(),
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
      Effect.withSpan("getAllSchedulesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
