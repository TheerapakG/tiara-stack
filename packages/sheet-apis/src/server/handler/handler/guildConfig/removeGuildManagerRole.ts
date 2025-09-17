import { removeGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { GuildConfigManagerRole } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { OnceObserver } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.Array(GuildConfigManagerRole);

export const removeGuildManagerRoleHandler = defineHandlerBuilder()
  .config(removeGuildManagerRoleHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(
            removeGuildManagerRoleHandlerConfig,
          ).request.parsed(),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.removeGuildManagerRole(
          parsed.guildId,
          parsed.roleId,
        ),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("removeGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  );
