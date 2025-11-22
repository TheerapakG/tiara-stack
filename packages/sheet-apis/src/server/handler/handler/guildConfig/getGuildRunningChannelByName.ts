import { getGuildRunningChannelByNameHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Either, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getGuildRunningChannelByNameHandler = pipe(
  builders.empty(),
  builders.data(getGuildRunningChannelByNameHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(
          getGuildRunningChannelByNameHandlerConfig,
        ),
      ),
      Computed.flatMapComputed(({ parsed: { guildId, channelName }, scope }) =>
        pipe(
          GuildConfigService.getGuildRunningChannelByName(guildId, channelName),
          Scope.extend(scope),
        ),
      ),
      Computed.map(
        Result.map(
          Either.fromOption(() =>
            Error.Core.makeArgumentError(
              "Cannot get running channel by name, the guild  or the channel name might not be registered",
            ),
          ),
        ),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(
          getGuildRunningChannelByNameHandlerConfig,
        ),
      ),
      Effect.withSpan("getGuildRunningChannelByNameHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
