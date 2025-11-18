import { getZeroGuildRunningChannelByNameHandlerConfig } from "@/server/handler/config";
import { Error, Core, ZeroGuildChannelConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Option, pipe, Either } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

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
        Core.Result.map(
          Either.liftPredicate(Option.isSome<ZeroGuildChannelConfig>, () =>
            Error.Core.makeArgumentError(
              "Cannot get running channel by name, the guild or the channel name might not be registered",
            ),
          ),
        ),
      ),
      Computed.map(Core.Result.map(Either.map((v) => v.value))),
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
