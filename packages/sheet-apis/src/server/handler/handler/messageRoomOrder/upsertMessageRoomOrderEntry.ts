import { upsertMessageRoomOrderEntryHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();

export const upsertMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageRoomOrderEntryHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(upsertMessageRoomOrderEntryHandlerData),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ messageId, hour, entries }) =>
          MessageRoomOrderService.upsertMessageRoomOrderEntry(
            messageId,
            entries.map((entry) => ({ ...entry, hour, tags: [...entry.tags] })),
          ),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Data.encodeResponseEffect(upsertMessageRoomOrderEntryHandlerData),
        Effect.withSpan("upsertMessageRoomOrderEntryHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
