import { upsertMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const upsertMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageRoomOrderEntryHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertMessageRoomOrderEntryHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId, hour, entries }) =>
        MessageRoomOrderService.upsertMessageRoomOrderEntry(
          messageId,
          entries.map((entry) => ({ ...entry, hour, tags: [...entry.tags] })),
        ),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(upsertMessageRoomOrderEntryHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("upsertMessageRoomOrderEntryHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
