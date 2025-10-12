import { incrementMessageRoomOrderRankHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const incrementMessageRoomOrderRankHandler = pipe(
  builders.empty(),
  builders.data(incrementMessageRoomOrderRankHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(incrementMessageRoomOrderRankHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId }) =>
        MessageRoomOrderService.incrementMessageRoomOrderRank(messageId),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(incrementMessageRoomOrderRankHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("incrementMessageRoomOrderRankHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
