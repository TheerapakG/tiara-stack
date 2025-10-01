import { removeGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { GuildConfigManagerRole } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const responseSchema = Schema.Array(GuildConfigManagerRole);

const builders = Context.Mutation.Builder.builders();
export const removeGuildManagerRoleHandler = pipe(
  builders.empty(),
  builders.data(removeGuildManagerRoleHandlerConfig),
  builders.handler(
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
