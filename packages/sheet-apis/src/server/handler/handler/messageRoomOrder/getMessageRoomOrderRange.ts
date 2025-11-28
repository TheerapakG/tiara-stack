import { getMessageRoomOrderRangeHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, Either, flow, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderRangeHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderRangeHandlerConfig),
  builders.handler(
    pipe(
      Effect.succeed(Event.someToken()),
      Effect.map(Effect.flatMap(AuthService.verify)),
      Effect.map(
        flow(
          Effect.flatMap(() =>
            Event.request.parsedWithScope(
              getMessageRoomOrderRangeHandlerConfig,
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        flow(
          Effect.flatMap(({ parsed, scope }) =>
            pipe(
              MessageRoomOrderService.getMessageRoomOrderRange(parsed),
              Scope.extend(scope),
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        Effect.map(
          Result.map(
            Either.fromOption(() =>
              Error.Core.makeArgumentError(
                "Cannot get message room order range, the message might not be registered",
              ),
            ),
          ),
        ),
      ),
      Effect.map(Error.Core.catchParseErrorAsValidationError),
      Effect.map(
        Handler.Config.encodeResponseEffect(
          getMessageRoomOrderRangeHandlerConfig,
        ),
      ),
      Effect.withSpan("getMessageRoomOrderRangeHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
