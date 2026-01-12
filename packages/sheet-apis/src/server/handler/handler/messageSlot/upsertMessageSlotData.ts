import { upsertMessageSlotDataHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, MessageSlotService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();

export const upsertMessageSlotDataHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageSlotDataHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(upsertMessageSlotDataHandlerData),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ messageId, ...data }) =>
          MessageSlotService.upsertMessageSlotData(messageId, data),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Data.encodeResponseEffect(upsertMessageSlotDataHandlerData),
        Effect.withSpan("upsertMessageSlotDataHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
