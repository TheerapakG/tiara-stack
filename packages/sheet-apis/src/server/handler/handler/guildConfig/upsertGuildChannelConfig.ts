import { upsertGuildChannelConfigHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
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
      Error.Core.catchParseErrorAsValidationError,
      Effect.either,
      Effect.flatMap(
        Handler.Config.encodeResponse(upsertGuildChannelConfigHandlerConfig),
      ),
      Effect.orDie,
      Effect.flatten,
      Effect.withSpan("upsertGuildChannelConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
