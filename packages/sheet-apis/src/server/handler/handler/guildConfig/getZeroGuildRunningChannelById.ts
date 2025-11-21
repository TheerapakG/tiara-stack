import { getZeroGuildRunningChannelByIdHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Either } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getZeroGuildRunningChannelByIdHandler = pipe(
  builders.empty(),
  builders.data(getZeroGuildRunningChannelByIdHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getZeroGuildRunningChannelByIdHandlerConfig),
      ),
      Computed.flatMapComputed(({ guildId, channelId }) =>
        GuildConfigService.getZeroGuildRunningChannelById(guildId, channelId),
      ),
      Computed.map(
        Result.map(
          Either.fromOption(() =>
            Error.Core.makeArgumentError(
              "Cannot get running channel by id, the guild or the channel id might not be registered",
            ),
          ),
        ),
      ),
      Computed.tap(Effect.log),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(
          getZeroGuildRunningChannelByIdHandlerConfig,
        ),
      ),
      Effect.withSpan("getZeroGuildRunningChannelByIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
