import { getZeroGuildRunningChannelByIdHandlerConfig } from "@/server/handler/config";
import { Error, Core, ZeroGuildChannelConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Option, pipe, Either } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

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
        Core.Result.map(
          Either.liftPredicate(Option.isSome<ZeroGuildChannelConfig>, () =>
            Error.Core.makeArgumentError(
              "Cannot get running channel by id, the guild or the channel id might not be registered",
            ),
          ),
        ),
      ),
      Computed.map(Core.Result.map(Either.map((v) => v.value))),
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
