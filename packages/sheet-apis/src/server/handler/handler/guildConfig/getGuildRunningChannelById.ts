import { getGuildRunningChannelByIdHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();
export const getGuildRunningChannelByIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildRunningChannelByIdHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.bind("parsed", () => Event.request.parsed(getGuildRunningChannelByIdHandlerData)),
        Effect.flatMap(({ parsed }) => GuildConfigService.getGuildRunningChannelById(parsed)),
        Effect.map(
          Effect.map(
            Result.eitherSomeOrLeft(() =>
              Error.Core.makeArgumentError(
                "Cannot get running channel by id, the guild or the channel might not be registered",
              ),
            ),
          ),
        ),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Data.encodeResponseEffect(getGuildRunningChannelByIdHandlerData)),
        Effect.withSpan("getGuildRunningChannelByIdHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
