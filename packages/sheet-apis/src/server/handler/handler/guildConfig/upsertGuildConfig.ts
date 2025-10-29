import { upsertGuildConfigHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();
export const upsertGuildConfigHandler = pipe(
  builders.empty(),
  builders.data(upsertGuildConfigHandlerConfig),
  builders.handler(
    pipe(
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertGuildConfigHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ guildId, ...config }) =>
        GuildConfigService.upsertGuildConfig(guildId, config),
      ),
      Error.Core.catchParseErrorAsValidationError,
      Effect.either,
      Effect.flatMap(
        Handler.Config.encodeResponse(upsertGuildConfigHandlerConfig),
      ),
      Effect.orDie,
      Effect.flatten,
      Effect.withSpan("upsertGuildConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
