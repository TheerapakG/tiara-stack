import { getMessageSlotDataHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageSlotService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
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
      Computed.flatMapComputed(MessageSlotService.getMessageSlotData),
      Computed.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              Error.Core.makeArgumentError(
                "Cannot get message slot data, the message might not be registered",
              ),
            ),
        }),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(getMessageSlotDataHandlerConfig),
      ),
      Effect.withSpan("getMessageSlotDataHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
