import { getMessageSlotDataHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageSlotService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();

export const getMessageSlotDataHandler = pipe(
  builders.empty(),
  builders.data(getMessageSlotDataHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.bind("parsed", () => Event.request.parsed(getMessageSlotDataHandlerConfig)),
        Effect.flatMap(({ parsed }) => MessageSlotService.getMessageSlotData(parsed)),
        Effect.map(
          Effect.map(
            Result.eitherSomeOrLeft(() =>
              Error.Core.makeArgumentError(
                "Cannot get message slot data, the message might not be registered",
              ),
            ),
          ),
        ),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Config.encodeResponseEffect(getMessageSlotDataHandlerConfig)),
        Effect.withSpan("getMessageSlotDataHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
