import { getMessageCheckinMembersHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();

export const getMessageCheckinMembersHandler = pipe(
  builders.empty(),
  builders.data(getMessageCheckinMembersHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.bind("parsed", () => Event.request.parsed(getMessageCheckinMembersHandlerData)),
        Effect.flatMap(({ parsed }) => MessageCheckinService.getMessageCheckinMembers(parsed)),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Data.encodeResponseEffect(getMessageCheckinMembersHandlerData)),
        Effect.withSpan("getMessageCheckinMembersHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
