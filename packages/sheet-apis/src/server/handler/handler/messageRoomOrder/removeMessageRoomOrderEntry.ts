import { removeMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
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
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(removeMessageRoomOrderEntryHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId }) =>
        MessageRoomOrderService.removeMessageRoomOrderEntry(messageId),
      ),
      Error.Core.catchParseErrorAsValidationError,
      Handler.Config.encodeResponseEffect(
        removeMessageRoomOrderEntryHandlerConfig,
      ),
      Effect.withSpan("removeMessageRoomOrderEntryHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
