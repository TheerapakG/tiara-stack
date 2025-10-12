import { addMessageCheckinMembersHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const addMessageCheckinMembersHandler = pipe(
  builders.empty(),
  builders.data(addMessageCheckinMembersHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(addMessageCheckinMembersHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId, memberIds }) =>
        MessageCheckinService.addMessageCheckinMembers(messageId, [
          ...memberIds,
        ]),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(addMessageCheckinMembersHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("addMessageCheckinMembersHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
