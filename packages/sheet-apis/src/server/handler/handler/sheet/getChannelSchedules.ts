import { getChannelSchedulesHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getChannelSchedulesHandler = pipe(
  builders.empty(),
  builders.data(getChannelSchedulesHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getChannelSchedulesHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, channel }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Sheet.SheetService.getChannelSchedules(channel),
              Computed.make,
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getChannelSchedulesHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getChannelSchedulesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
