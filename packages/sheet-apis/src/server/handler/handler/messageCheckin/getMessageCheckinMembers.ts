import { getMessageCheckinMembersHandlerConfig } from "@/server/handler/config";
import { AuthService, MessageCheckinService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getMessageCheckinMembersHandler = pipe(
  builders.empty(),
  builders.data(getMessageCheckinMembersHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getMessageCheckinMembersHandlerConfig),
      ),
      Computed.flatMap(MessageCheckinService.getMessageCheckinMembers),
      Computed.flatMap(Function.identity),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getMessageCheckinMembersHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getMessageCheckinMembersHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
