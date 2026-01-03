import { incrementMessageRoomOrderRankHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Mutation.Builder.builders();

export const incrementMessageRoomOrderRankHandler = pipe(
  builders.empty(),
  builders.data(incrementMessageRoomOrderRankHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(incrementMessageRoomOrderRankHandlerConfig),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ messageId }) =>
          MessageRoomOrderService.incrementMessageRoomOrderRank(messageId),
        ),
        Effect.flatMap(
          Option.match({
            onSome: Effect.succeed,
            onNone: () =>
              Effect.fail(
                Error.Core.makeArgumentError(
                  "Cannot increment message room order rank, the message might not be registered",
                ),
              ),
          }),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Config.encodeResponseEffect(
          incrementMessageRoomOrderRankHandlerConfig,
        ),
        Effect.withSpan("incrementMessageRoomOrderRankHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
