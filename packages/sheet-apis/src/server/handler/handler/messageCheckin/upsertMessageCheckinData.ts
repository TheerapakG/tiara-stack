import { upsertMessageCheckinDataHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();

export const upsertMessageCheckinDataHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageCheckinDataHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertMessageCheckinDataHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ messageId, ...data }) =>
        MessageCheckinService.upsertMessageCheckinData(messageId, data),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(upsertMessageCheckinDataHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("upsertMessageCheckinDataHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
