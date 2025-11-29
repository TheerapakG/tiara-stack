import { getMessageRoomOrderHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderHandlerConfig),
  builders.handler(
    pipe(
      Effect.Do,
      Effect.tap(() =>
        pipe(Event.someToken(), Effect.flatMap(AuthService.verify)),
      ),
      Effect.bind("parsed", () =>
        Event.request.parsed(getMessageRoomOrderHandlerConfig),
      ),
      Effect.flatMap(({ parsed }) =>
        MessageRoomOrderService.getMessageRoomOrder(parsed),
      ),
      Effect.map(
        Effect.map(
          Result.eitherSomeOrLeft(() =>
            Error.Core.makeArgumentError(
              "Cannot get message room order, the message might not be registered",
            ),
          ),
        ),
      ),
      Effect.map(Error.Core.catchParseErrorAsValidationError),
      Effect.map(
        Handler.Config.encodeResponseEffect(getMessageRoomOrderHandlerConfig),
      ),
      Effect.withSpan("getMessageRoomOrderHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
