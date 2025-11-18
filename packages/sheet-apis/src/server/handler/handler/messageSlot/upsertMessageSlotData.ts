import { upsertMessageSlotDataHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageSlotService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const upsertMessageSlotDataHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageSlotDataHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertMessageSlotDataHandlerConfig),
          Effect.flatMap(UntilObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId, ...data }) =>
        MessageSlotService.upsertMessageSlotData(messageId, data),
      ),
      Error.Core.catchParseErrorAsValidationError,
      Handler.Config.encodeResponseEffect(upsertMessageSlotDataHandlerConfig),
      Effect.withSpan("upsertMessageSlotDataHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
