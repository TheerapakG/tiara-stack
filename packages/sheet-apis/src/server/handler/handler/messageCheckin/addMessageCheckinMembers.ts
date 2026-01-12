import { addMessageCheckinMembersHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();

export const addMessageCheckinMembersHandler = pipe(
  builders.empty(),
  builders.data(addMessageCheckinMembersHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(addMessageCheckinMembersHandlerData),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ messageId, memberIds }) =>
          MessageCheckinService.addMessageCheckinMembers(messageId, memberIds),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Data.encodeResponseEffect(addMessageCheckinMembersHandlerData),
        Effect.withSpan("addMessageCheckinMembersHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
