import { getMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderEntryHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getMessageRoomOrderEntryHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed: { messageId, rank }, scope }) =>
        pipe(
          MessageRoomOrderService.getMessageRoomOrderEntry(messageId, rank),
          Scope.extend(scope),
        ),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
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
