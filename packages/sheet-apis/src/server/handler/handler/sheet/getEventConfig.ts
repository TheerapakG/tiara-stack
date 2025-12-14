import { getEventConfigHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getEventConfigHandler = pipe(
  builders.empty(),
  builders.data(getEventConfigHandlerConfig),
  builders.handler(
    pipe(
      Effect.Do,
      Effect.tap(() =>
        pipe(Event.someToken(), Effect.flatMap(AuthService.verify)),
      ),
      Effect.bind("parsed", () =>
        Event.request.parsed(getEventConfigHandlerConfig),
      ),
      Effect.bind("layerOfGuildId", ({ parsed }) =>
        pipe(
          Sheet.layerOfGuildId(
            pipe(
              parsed,
              Effect.map(({ guildId }) => guildId),
            ),
          ),
          Effect.map(
            Effect.map(
              Result.someOrLeft(() =>
                Error.Core.makeArgumentError(
                  "Cannot get sheet by guild id, the guild might not be registered",
                ),
              ),
            ),
          ),
        ),
      ),
      Effect.map(({ layerOfGuildId }) =>
        pipe(
          layerOfGuildId,
          Effect.flatMap((layerOfGuildId) =>
            pipe(
              Sheet.SheetService.getEventConfig(),
              Result.provideEitherLayer(layerOfGuildId),
              Effect.tap((eventConfig) =>
                Effect.log(layerOfGuildId, eventConfig),
              ),
            ),
          ),
        ),
      ),
      Effect.map(Error.Core.catchParseErrorAsValidationError),
      Effect.map(
        Handler.Config.encodeResponseEffect(getEventConfigHandlerConfig),
      ),
      Effect.withSpan("getEventConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
