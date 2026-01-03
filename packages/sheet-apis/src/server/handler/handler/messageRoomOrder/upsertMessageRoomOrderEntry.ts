import { upsertMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Mutation.Builder.builders();

export const upsertMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageRoomOrderEntryHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(upsertMessageRoomOrderEntryHandlerConfig),
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
        Handler.Config.encodeResponseEffect(
          upsertMessageRoomOrderEntryHandlerConfig,
        ),
        Effect.withSpan("upsertMessageRoomOrderEntryHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
