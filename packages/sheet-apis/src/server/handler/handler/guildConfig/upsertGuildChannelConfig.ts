import { upsertGuildChannelConfigHandlerConfig } from "@/server/handler/config";
import { GuildChannelConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);

const builders = Context.Mutation.Builder.builders();
export const upsertGuildChannelConfigHandler = pipe(
  builders.empty(),
  builders.data(upsertGuildChannelConfigHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertGuildChannelConfigHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.upsertGuildChannelConfig(
          parsed.guildId,
          parsed.channelId,
          {
            name: parsed.name,
            running: parsed.running,
            roleId: parsed.roleId,
            checkinChannelId: parsed.checkinChannelId,
          },
        ),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("upsertGuildChannelConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
