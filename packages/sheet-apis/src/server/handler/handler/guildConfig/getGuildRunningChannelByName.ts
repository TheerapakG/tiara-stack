import { getGuildRunningChannelByNameHandlerConfig } from "@/server/handler/config";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Option, pipe, Schema } from "effect";
import { Argument } from "typhoon-core/error";
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
              new Argument.ArgumentError({
                message:
                  "No such guild running channel, channel might not be registered",
              }),
            ),
        }),
      ),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getGuildRunningChannelByNameHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getGuildRunningChannelByNameHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
