import { getMessageCheckinDataHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();

export const getMessageCheckinDataHandler = pipe(
  builders.empty(),
  builders.data(getMessageCheckinDataHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() =>
          pipe(Event.someToken(), Effect.flatMap(AuthService.verify)),
        ),
        Effect.bind("parsed", () =>
          Event.request.parsed(getMessageCheckinDataHandlerConfig),
        ),
        Effect.flatMap(({ parsed }) =>
          MessageCheckinService.getMessageCheckinData(parsed),
        ),
        Effect.map(
          Effect.map(
            Result.eitherSomeOrLeft(() =>
              Error.Core.makeArgumentError(
                "Cannot get checkin data, the message might not be registered",
              ),
            ),
          ),
        ),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(
          Handler.Config.encodeResponseEffect(
            getMessageCheckinDataHandlerConfig,
          ),
        ),
        Effect.withSpan("getMessageCheckinDataHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
