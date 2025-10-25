import { upsertMessageRoomOrderHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const upsertMessageRoomOrderHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageRoomOrderHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertMessageRoomOrderHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId, ...data }) =>
        MessageRoomOrderService.upsertMessageRoomOrder(messageId, data),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(upsertMessageRoomOrderHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("upsertMessageRoomOrderHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
