import { getMessageRoomOrderRangeHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, Either, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderRangeHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderRangeHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getMessageRoomOrderRangeHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed, scope }) =>
        pipe(
          MessageRoomOrderService.getMessageRoomOrderRange(parsed),
          Scope.extend(scope),
        ),
      ),
      Computed.map(
        Result.map(
          Either.fromOption(() =>
            Error.Core.makeArgumentError(
              "Cannot get message room order range, the message might not be registered",
            ),
          ),
        ),
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
