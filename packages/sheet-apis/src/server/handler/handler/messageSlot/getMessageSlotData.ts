import { getMessageSlotDataHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageSlotService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageSlotDataHandler = pipe(
  builders.empty(),
  builders.data(getMessageSlotDataHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getMessageSlotDataHandlerConfig),
      ),
      Computed.flatMap(MessageSlotService.getMessageSlotData),
      Computed.flatMap(Function.identity),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getMessageSlotDataHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getMessageSlotDataHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
