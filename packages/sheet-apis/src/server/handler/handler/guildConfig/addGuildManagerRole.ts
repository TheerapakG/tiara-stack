import { addGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Mutation.Builder.builders();
export const addGuildManagerRoleHandler = pipe(
  builders.empty(),
  builders.data(addGuildManagerRoleHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(addGuildManagerRoleHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.addGuildManagerRole(parsed.guildId, parsed.roleId),
      ),
      Effect.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(addGuildManagerRoleHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("addGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
