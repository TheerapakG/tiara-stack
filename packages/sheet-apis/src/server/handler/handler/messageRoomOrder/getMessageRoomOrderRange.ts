import { getMessageRoomOrderRangeHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderRangeHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderRangeHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getMessageRoomOrderRangeHandlerConfig),
      ),
      Computed.flatMapComputed(
        MessageRoomOrderService.getMessageRoomOrderRange,
      ),
      Computed.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              Error.Core.makeArgumentError(
                "Cannot get message room order range, the message might not be registered",
              ),
            ),
        }),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(
          getMessageRoomOrderRangeHandlerConfig,
        ),
      ),
      Effect.withSpan("getMessageRoomOrderRangeHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
