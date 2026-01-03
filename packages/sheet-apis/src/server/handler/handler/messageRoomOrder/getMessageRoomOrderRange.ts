import { getMessageRoomOrderRangeHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderRangeHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderRangeHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() =>
          pipe(Event.someToken(), Effect.flatMap(AuthService.verify)),
        ),
        Effect.bind("parsed", () =>
          Event.request.parsed(getMessageRoomOrderRangeHandlerConfig),
        ),
        Effect.flatMap(({ parsed }) =>
          MessageRoomOrderService.getMessageRoomOrderRange(parsed),
        ),
        Effect.map(
          Effect.map(
            Result.eitherSomeOrLeft(() =>
              Error.Core.makeArgumentError(
                "Cannot get message room order range, the message might not be registered",
              ),
            ),
          ),
        ),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(
          Handler.Config.encodeResponseEffect(
            getMessageRoomOrderRangeHandlerConfig,
          ),
        ),
        Effect.withSpan("getMessageRoomOrderRangeHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
