import { removeMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const removeMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(removeMessageRoomOrderEntryHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(removeMessageRoomOrderEntryHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId }) =>
        MessageRoomOrderService.removeMessageRoomOrderEntry(messageId),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(removeMessageRoomOrderEntryHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("removeMessageRoomOrderEntryHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
