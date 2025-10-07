import { removeGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

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
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(removeGuildManagerRoleHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("removeGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
