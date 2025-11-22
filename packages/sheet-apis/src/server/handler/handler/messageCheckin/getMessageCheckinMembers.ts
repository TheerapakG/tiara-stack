import { getMessageCheckinMembersHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageCheckinMembersHandler = pipe(
  builders.empty(),
  builders.data(getMessageCheckinMembersHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getMessageCheckinMembersHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed, scope }) =>
        pipe(
          MessageCheckinService.getMessageCheckinMembers(parsed),
          Scope.extend(scope),
        ),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(
          getMessageCheckinMembersHandlerConfig,
        ),
      ),
      Effect.withSpan("getMessageCheckinMembersHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
