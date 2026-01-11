import { getAutoCheckinGuildsHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();
export const getAutoCheckinGuildsHandler = pipe(
  builders.empty(),
  builders.data(getAutoCheckinGuildsHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.flatMap(() => GuildConfigService.getAutoCheckinGuilds()),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Config.encodeResponseEffect(getAutoCheckinGuildsHandlerConfig)),
        Effect.withSpan("getAutoCheckinGuildsHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
