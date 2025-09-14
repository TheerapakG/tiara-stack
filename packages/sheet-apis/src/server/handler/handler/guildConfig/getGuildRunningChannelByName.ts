import { getGuildRunningChannelByNameHandlerConfig } from "@/server/handler/config";
import { GuildChannelConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { computed, Computed } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);

export const getGuildRunningChannelByNameHandler = defineHandlerBuilder()
  .config(getGuildRunningChannelByNameHandlerConfig)
  .handler(
    pipe(
      computed(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.withConfig(
          getGuildRunningChannelByNameHandlerConfig,
        ).request.parsed(),
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
  );
