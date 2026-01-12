import { getMessageRoomOrderEntryHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();

export const getMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderEntryHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.bind("parsed", () => Event.request.parsed(getMessageRoomOrderEntryHandlerData)),
        Effect.flatMap(({ parsed }) => MessageRoomOrderService.getMessageRoomOrderEntry(parsed)),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Data.encodeResponseEffect(getMessageRoomOrderEntryHandlerData)),
        Effect.withSpan("getMessageRoomOrderEntryHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
