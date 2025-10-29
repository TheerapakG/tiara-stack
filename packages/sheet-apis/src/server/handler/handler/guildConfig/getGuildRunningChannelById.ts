import { getGuildRunningChannelByIdHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getGuildRunningChannelByIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildRunningChannelByIdHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildRunningChannelByIdHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, channelId }) =>
        GuildConfigService.getGuildRunningChannelById(guildId, channelId),
      ),
      Computed.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              Error.Core.makeArgumentError(
                "No such guild running channel, channel might not be registered",
              ),
            ),
        }),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(Effect.either),
      Computed.flatMap(
        Handler.Config.encodeResponse(getGuildRunningChannelByIdHandlerConfig),
      ),
      Computed.mapEffect(Effect.orDie),
      Computed.mapEffect(Effect.flatten),
      Effect.withSpan("getGuildRunningChannelByIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
