import { removeGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { GuildConfigManagerRole } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/server";

const responseSchema = Schema.Array(GuildConfigManagerRole);

export const removeGuildManagerRoleHandler = pipe(
  HandlerContextConfig.empty,
  HandlerContextConfig.Builder.config(removeGuildManagerRoleHandlerConfig),
  HandlerContextConfig.Builder.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(removeGuildManagerRoleHandlerConfig),
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
  ),
);
