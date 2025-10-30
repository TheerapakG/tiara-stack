import { setMessageCheckinMemberCheckinAtHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const setMessageCheckinMemberCheckinAtHandler = pipe(
  builders.empty(),
  builders.data(setMessageCheckinMemberCheckinAtHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(setMessageCheckinMemberCheckinAtHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
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
      Handler.Config.encodeResponseEffect(
        setMessageCheckinMemberCheckinAtHandlerConfig,
      ),
      Effect.withSpan("setMessageCheckinMemberCheckinAtHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
