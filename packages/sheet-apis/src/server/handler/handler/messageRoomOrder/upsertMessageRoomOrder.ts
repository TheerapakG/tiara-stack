import { upsertMessageRoomOrderHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
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
      Error.Core.catchParseErrorAsValidationError,
      Handler.Config.encodeResponseEffect(upsertMessageRoomOrderHandlerConfig),
      Effect.withSpan("upsertMessageRoomOrderHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
