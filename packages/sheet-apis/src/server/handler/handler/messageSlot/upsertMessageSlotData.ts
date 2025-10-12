import { upsertMessageSlotDataHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageSlotService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const upsertMessageSlotDataHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageSlotDataHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertMessageSlotDataHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId, ...data }) =>
        MessageSlotService.upsertMessageSlotData(messageId, data),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(upsertMessageSlotDataHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("upsertMessageSlotDataHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
