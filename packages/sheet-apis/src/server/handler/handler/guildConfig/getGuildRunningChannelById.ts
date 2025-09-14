import { getGuildRunningChannelByIdHandlerConfig } from "@/server/handler/config";
import { GuildChannelConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { computed, Computed } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);

export const getGuildRunningChannelByIdHandler = defineHandlerBuilder()
  .config(getGuildRunningChannelByIdHandlerConfig)
  .handler(
    pipe(
      computed(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.withConfig(
          getGuildRunningChannelByIdHandlerConfig,
        ).request.parsed(),
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
  );
