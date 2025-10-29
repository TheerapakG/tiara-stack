import { upsertGuildChannelConfigHandlerConfig } from "@/server/handler/config";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();
export const upsertGuildChannelConfigHandler = pipe(
  builders.empty(),
  builders.data(upsertGuildChannelConfigHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertGuildChannelConfigHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(
        ({ guildId, channelId, name, running, roleId, checkinChannelId }) =>
          GuildConfigService.upsertGuildChannelConfig(guildId, channelId, {
            name,
            running,
            roleId,
            checkinChannelId,
          }),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(upsertGuildChannelConfigHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("upsertGuildChannelConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
