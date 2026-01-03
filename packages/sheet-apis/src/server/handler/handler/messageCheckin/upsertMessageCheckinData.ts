import { upsertMessageCheckinDataHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();

export const upsertMessageCheckinDataHandler = pipe(
  builders.empty(),
  builders.data(upsertMessageCheckinDataHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(upsertMessageCheckinDataHandlerConfig),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ messageId, ...data }) =>
          MessageCheckinService.upsertMessageCheckinData(messageId, data),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Config.encodeResponseEffect(
          upsertMessageCheckinDataHandlerConfig,
        ),
        Effect.withSpan("upsertMessageCheckinDataHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
