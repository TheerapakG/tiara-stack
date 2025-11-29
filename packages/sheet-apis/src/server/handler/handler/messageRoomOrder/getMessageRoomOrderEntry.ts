import { getMessageRoomOrderEntryHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, MessageRoomOrderService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageRoomOrderEntryHandler = pipe(
  builders.empty(),
  builders.data(getMessageRoomOrderEntryHandlerConfig),
  builders.handler(
    pipe(
      Effect.Do,
      Effect.tap(() =>
        pipe(Event.someToken(), Effect.flatMap(AuthService.verify)),
      ),
      Effect.bind("parsed", () =>
        Event.request.parsed(getMessageRoomOrderEntryHandlerConfig),
      ),
      Effect.flatMap(({ parsed }) =>
        MessageRoomOrderService.getMessageRoomOrderEntry(parsed),
      ),
      Effect.map(Error.Core.catchParseErrorAsValidationError),
      Effect.map(
        Handler.Config.encodeResponseEffect(
          getMessageRoomOrderEntryHandlerConfig,
        ),
      ),
      Effect.withSpan("getMessageRoomOrderEntryHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
