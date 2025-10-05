import { getTeamsHandlerConfig } from "@/server/handler/config";
import { Team } from "@/server/schema";
import { AuthService, SheetService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getTeamsHandler = pipe(
  builders.empty(),
  builders.data(getTeamsHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getTeamsHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          SheetService.ofGuild(guildId),
          Effect.flatMap((layer) =>
            pipe(
              SheetService.getTeams(),
              Effect.map(Signal.make),
              Computed.provideLayerComputed(layer),
            ),
          ),
        ),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Schema.HashMap({
            key: Schema.String,
            value: Schema.Struct({
              name: Schema.String,
              teams: Schema.Array(Team),
            }),
          }),
        ),
      ),
      Effect.withSpan("getTeamsHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
