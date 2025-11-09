import { mapScheduleWithPlayersHandlerConfig } from "@/server/handler/config";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const mapScheduleWithPlayersHandler = pipe(
  builders.empty(),
  builders.data(mapScheduleWithPlayersHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(mapScheduleWithPlayersHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, schedules }) =>
        pipe(
          Sheet.layerOfGuildId(guildId),
          Effect.flatMap((layer) =>
            pipe(
              Effect.forEach(
                schedules,
                Sheet.PlayerService.mapScheduleWithPlayers,
                {
                  concurrency: "unbounded",
                },
              ),
              Computed.make,
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(mapScheduleWithPlayersHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("mapScheduleWithPlayersHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
