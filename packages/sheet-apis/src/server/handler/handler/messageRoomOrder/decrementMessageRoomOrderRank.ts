import { decrementMessageRoomOrderRankHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
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
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(decrementMessageRoomOrderRankHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("decrementMessageRoomOrderRankHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
