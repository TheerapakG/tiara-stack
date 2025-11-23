import { getMessageCheckinDataHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Either, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();

export const getMessageCheckinDataHandler = pipe(
  builders.empty(),
  builders.data(getMessageCheckinDataHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getMessageCheckinDataHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed, scope }) =>
        pipe(
          MessageCheckinService.getMessageCheckinData(parsed),
          Scope.extend(scope),
        ),
      ),
      Computed.map(
        Result.map(
          Either.fromOption(() =>
            Error.Core.makeArgumentError(
              "Cannot get chesckin data, the message might not be registered",
            ),
          ),
        ),
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
