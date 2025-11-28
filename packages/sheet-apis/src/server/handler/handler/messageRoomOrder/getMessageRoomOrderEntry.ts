import { getMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, flow, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderEntryHandlerConfig),
  builders.handler(
    pipe(
      Effect.succeed(Event.someToken()),
      Effect.map(Effect.flatMap(AuthService.verify)),
      Effect.map(
        flow(
          Effect.flatMap(() =>
            Event.request.parsedWithScope(
              getMessageRoomOrderEntryHandlerConfig,
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        flow(
          Effect.flatMap(({ parsed: { messageId, rank }, scope }) =>
            pipe(
              MessageRoomOrderService.getMessageRoomOrderEntry(messageId, rank),
              Scope.extend(scope),
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(Error.Core.catchParseErrorAsValidationError),
      Effect.map(
        Handler.Config.encodeResponseEffect(
          getMessageRoomOrderEntryHandlerConfig,
        ),
      ),
      Effect.withSpan("getMessageRoomOrderEntryHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
