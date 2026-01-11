import { removeMessageCheckinMemberHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();

export const removeMessageCheckinMemberHandler = pipe(
  builders.empty(),
  builders.data(removeMessageCheckinMemberHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(removeMessageCheckinMemberHandlerConfig),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ messageId, memberId }) =>
          MessageCheckinService.removeMessageCheckinMember(messageId, memberId),
        ),
        Effect.flatMap(
          Option.match({
            onSome: Effect.succeed,
            onNone: () =>
              Effect.fail(
                Error.Core.makeArgumentError(
                  "Cannot remove member, the message might not be registered, or the member is not on this message",
                ),
              ),
          }),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Config.encodeResponseEffect(removeMessageCheckinMemberHandlerConfig),
        Effect.withSpan("removeMessageCheckinMemberHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
