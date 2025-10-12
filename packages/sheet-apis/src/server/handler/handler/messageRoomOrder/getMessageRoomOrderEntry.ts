import { getMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
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
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getMessageRoomOrderEntryHandlerConfig),
      ),
      Computed.flatMap(({ messageId, rank }) =>
        MessageRoomOrderService.getMessageRoomOrderEntry(messageId, rank),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getMessageRoomOrderEntryHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getMessageRoomOrderEntryHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
