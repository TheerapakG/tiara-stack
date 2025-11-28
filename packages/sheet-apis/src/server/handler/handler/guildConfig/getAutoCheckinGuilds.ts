import { getAutoCheckinGuildsHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, flow, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getAutoCheckinGuildsHandler = pipe(
  builders.empty(),
  builders.data(getAutoCheckinGuildsHandlerConfig),
  builders.handler(
    pipe(
      Effect.succeed(Event.someToken()),
      Effect.map(Effect.flatMap(AuthService.verify)),
      Effect.map(
        flow(
          Effect.flatMap(() =>
            Event.request.parsedWithScope(getAutoCheckinGuildsHandlerConfig),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        flow(
          Effect.flatMap(({ scope }) =>
            pipe(
              GuildConfigService.getAutoCheckinGuilds(),
              Scope.extend(scope),
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(Error.Core.catchParseErrorAsValidationError),
      Effect.map(
        Handler.Config.encodeResponseEffect(getAutoCheckinGuildsHandlerConfig),
      ),
      Effect.withSpan("getAutoCheckinGuildsHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
