import { getTeamConfigHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, Sheet } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();
export const getTeamConfigHandler = pipe(
  builders.empty(),
  builders.data(getTeamConfigHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.bind("parsed", () => Event.request.parsed(getTeamConfigHandlerConfig)),
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
              pipe(Sheet.SheetService.getTeamConfig(), Result.provideEitherLayer(layerOfGuildId)),
            ),
          ),
        ),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Config.encodeResponseEffect(getTeamConfigHandlerConfig)),
        Effect.map(
          Effect.withSpan("getTeamConfigHandler", {
            captureStackTrace: true,
          }),
        ),
        Effect.withSpan("getTeamConfigHandler subscription", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
