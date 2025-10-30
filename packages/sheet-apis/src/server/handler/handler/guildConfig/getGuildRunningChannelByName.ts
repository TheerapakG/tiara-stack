import { getGuildRunningChannelByNameHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getGuildRunningChannelByNameHandler = pipe(
  builders.empty(),
  builders.data(getGuildRunningChannelByNameHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildRunningChannelByNameHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, channelName }) =>
        GuildConfigService.getGuildRunningChannelByName(guildId, channelName),
      ),
      Computed.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              Error.Core.makeArgumentError(
                "Cannot get running channel by name, the guild  or the channel name might not be registered",
              ),
            ),
        }),
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
