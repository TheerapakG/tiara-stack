import { getGuildRunningChannelByIdHandlerConfig } from "@/server/handler/config";
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
export const getGuildRunningChannelByIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildRunningChannelByIdHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildRunningChannelByIdHandlerConfig),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildRunningChannelById(
          parsed.guildId,
          parsed.channelId,
        ),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("getGuildRunningChannelByIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
