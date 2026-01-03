import { getGuildConfigByGuildIdHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Subscription.Builder.builders();
export const getGuildConfigByGuildIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildConfigByGuildIdHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() =>
          pipe(Event.someToken(), Effect.flatMap(AuthService.verify)),
        ),
        Effect.bind("parsed", () =>
          Event.request.parsed(getGuildConfigByGuildIdHandlerConfig),
        ),
        Effect.flatMap(({ parsed }) =>
          GuildConfigService.getGuildConfigByGuildId(parsed),
        ),
        Effect.map(
          Effect.map(
            Result.eitherSomeOrLeft(() =>
              Error.Core.makeArgumentError(
                "Cannot get guild config by guild id, the guild might not be registered",
              ),
            ),
          ),
        ),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(
          Handler.Config.encodeResponseEffect(
            getGuildConfigByGuildIdHandlerConfig,
          ),
        ),
        Effect.withSpan("getGuildConfigByGuildIdHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
