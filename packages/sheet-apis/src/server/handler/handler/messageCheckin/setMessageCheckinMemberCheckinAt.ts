import { setMessageCheckinMemberCheckinAtHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();

export const setMessageCheckinMemberCheckinAtHandler = pipe(
  builders.empty(),
  builders.data(setMessageCheckinMemberCheckinAtHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(setMessageCheckinMemberCheckinAtHandlerConfig),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(MessageCheckinService.setMessageCheckinMemberCheckinAt),
        Effect.flatMap(
          Option.match({
            onSome: Effect.succeed,
            onNone: () =>
              Effect.fail(
                Error.Core.makeArgumentError(
                  "Cannot check in member, the message might not be registered, the member is not on this message, or the checkin time is not within the allowed time frame",
                ),
              ),
          }),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Config.encodeResponseEffect(setMessageCheckinMemberCheckinAtHandlerConfig),
        Effect.withSpan("setMessageCheckinMemberCheckinAtHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
