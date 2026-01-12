import { getMessageRoomOrderRangeHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();

export const getMessageRoomOrderRangeHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderRangeHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.bind("parsed", () => Event.request.parsed(getMessageRoomOrderRangeHandlerData)),
        Effect.flatMap(({ parsed }) => MessageRoomOrderService.getMessageRoomOrderRange(parsed)),
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
        Effect.map(Handler.Data.encodeResponseEffect(getMessageRoomOrderRangeHandlerData)),
        Effect.withSpan("getMessageRoomOrderRangeHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
