import { decrementMessageRoomOrderRankHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const decrementMessageRoomOrderRankHandler = pipe(
  builders.empty(),
  builders.data(decrementMessageRoomOrderRankHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(decrementMessageRoomOrderRankHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId }) =>
        MessageRoomOrderService.decrementMessageRoomOrderRank(messageId),
      ),
      Effect.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              Error.Core.makeArgumentError(
                "Cannot decrement message room order rank, the message might not be registered",
              ),
            ),
        }),
      ),
      Error.Core.catchParseErrorAsValidationError,
      Handler.Config.encodeResponseEffect(
        decrementMessageRoomOrderRankHandlerConfig,
      ),
      Effect.withSpan("decrementMessageRoomOrderRankHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
