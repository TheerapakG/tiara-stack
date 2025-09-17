import { addGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { GuildConfigManagerRole } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { OnceObserver } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.OptionFromNullishOr(
  GuildConfigManagerRole,
  undefined,
);

export const addGuildManagerRoleHandler = defineHandlerBuilder()
  .config(addGuildManagerRoleHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(addGuildManagerRoleHandlerConfig).request.parsed(),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.addGuildManagerRole(parsed.guildId, parsed.roleId),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("addGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  );
