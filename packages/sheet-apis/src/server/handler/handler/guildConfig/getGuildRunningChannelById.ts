import { getGuildRunningChannelByIdHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Either, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getGuildRunningChannelByIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildRunningChannelByIdHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getGuildRunningChannelByIdHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed: { guildId, channelId }, scope }) =>
        pipe(
          GuildConfigService.getGuildRunningChannelById(guildId, channelId),
          Scope.extend(scope),
        ),
      ),
      Computed.map(
        Result.map(
          Either.fromOption(() =>
            Error.Core.makeArgumentError(
              "Cannot get running channel by id, the guild or the channel might not be registered",
            ),
          ),
        ),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(
          getGuildRunningChannelByIdHandlerConfig,
        ),
      ),
      Effect.withSpan("getGuildRunningChannelByIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
