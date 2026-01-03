import { upsertMessageRoomOrderHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Array, Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();

export const upsertMessageRoomOrderHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageRoomOrderHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(upsertMessageRoomOrderHandlerConfig),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ messageId, ...data }) =>
          MessageRoomOrderService.upsertMessageRoomOrder(messageId, {
            ...data,
            previousFills: Array.copy(data.previousFills),
            fills: Array.copy(data.fills),
          }),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Config.encodeResponseEffect(
          upsertMessageRoomOrderHandlerConfig,
        ),
        Effect.withSpan("upsertMessageRoomOrderHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
