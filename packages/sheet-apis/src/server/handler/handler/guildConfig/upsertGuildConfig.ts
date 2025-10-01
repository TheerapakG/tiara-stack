import { upsertGuildConfigHandlerConfig } from "@/server/handler/config";
import { GuildConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);

const builders = Context.Mutation.Builder.builders();
export const upsertGuildConfigHandler = pipe(
  builders.empty(),
  builders.data(upsertGuildConfigHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(upsertGuildConfigHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.upsertGuildConfig(parsed.guildId, parsed),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("upsertGuildConfigHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
