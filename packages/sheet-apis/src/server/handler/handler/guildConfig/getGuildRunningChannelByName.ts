import { getGuildRunningChannelByNameHandlerConfig } from "@/server/handler/config";
import { GuildChannelConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);

const builders = Context.Subscription.Builder.builders();
export const getGuildRunningChannelByNameHandler = pipe(
  builders.empty(),
  builders.data(getGuildRunningChannelByNameHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildRunningChannelByNameHandlerConfig),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildRunningChannelByName(
          parsed.guildId,
          parsed.channelName,
        ),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("getGuildRunningChannelByNameHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
