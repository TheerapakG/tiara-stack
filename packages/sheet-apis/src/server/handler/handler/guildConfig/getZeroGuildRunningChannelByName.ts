import { getZeroGuildRunningChannelByNameHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Either } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getZeroGuildRunningChannelByNameHandler = pipe(
  builders.empty(),
  builders.data(getZeroGuildRunningChannelByNameHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getZeroGuildRunningChannelByNameHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, channelName }) =>
        GuildConfigService.getZeroGuildRunningChannelByName(
          guildId,
          channelName,
        ),
      ),
      Computed.map(
        Result.map(
          Either.fromOption(() =>
            Error.Core.makeArgumentError(
              "Cannot get running channel by name, the guild or the channel name might not be registered",
            ),
          ),
        ),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(
          getZeroGuildRunningChannelByNameHandlerConfig,
        ),
      ),
      Effect.withSpan("getZeroGuildRunningChannelByNameHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
