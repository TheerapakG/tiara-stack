import { getRunnerConfigHandlerConfig } from "@/server/handler/config";
import { RunnerConfig } from "@/server/schema";
import { AuthService, SheetService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Computed, Signal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getRunnerConfigHandler = pipe(
  builders.empty(),
  builders.data(getRunnerConfigHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getRunnerConfigHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId }) =>
        pipe(
          SheetService.ofGuild(guildId),
          Effect.flatMap((layer) =>
            pipe(
              SheetService.getRunnerConfig(),
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
            value: RunnerConfig,
          }),
        ),
      ),
      Effect.withSpan("getRunnerConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
