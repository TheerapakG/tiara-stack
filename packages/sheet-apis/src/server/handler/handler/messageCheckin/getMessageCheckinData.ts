import { getMessageCheckinDataHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
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
      Computed.flatMapComputed(MessageCheckinService.getMessageCheckinData),
      Computed.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              Error.Core.makeArgumentError(
                "No checkin data for this message, message might not be registered",
              ),
            ),
        }),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(getMessageCheckinDataHandlerConfig),
      ),
      Effect.withSpan("getMessageCheckinDataHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
