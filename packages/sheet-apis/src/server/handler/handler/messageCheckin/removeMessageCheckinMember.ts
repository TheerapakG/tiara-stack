import { removeMessageCheckinMemberHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const removeMessageCheckinMemberHandler = pipe(
  builders.empty(),
  builders.data(removeMessageCheckinMemberHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(removeMessageCheckinMemberHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId, memberId }) =>
        MessageCheckinService.removeMessageCheckinMember(messageId, memberId),
      ),
      Error.Core.catchParseErrorAsValidationError,
      Handler.Config.encodeResponseEffect(
        removeMessageCheckinMemberHandlerConfig,
      ),
      Effect.withSpan("removeMessageCheckinMemberHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
