import { getMessageCheckinDataHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageCheckinDataHandler = pipe(
  builders.empty(),
  builders.data(getMessageCheckinDataHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getMessageCheckinDataHandlerConfig),
      ),
      Computed.flatMap(MessageCheckinService.getMessageCheckinData),
      Computed.flatMap(Function.identity),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getMessageCheckinDataHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getMessageCheckinDataHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
