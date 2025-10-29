import { removeGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
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
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(removeGuildManagerRoleHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ guildId, roleId }) =>
        GuildConfigService.removeGuildManagerRole(guildId, roleId),
      ),
      Error.Core.catchParseErrorAsValidationError,
      Effect.either,
      Effect.flatMap(
        Handler.Config.encodeResponse(removeGuildManagerRoleHandlerConfig),
      ),
      Effect.orDie,
      Effect.flatten,
      Effect.withSpan("removeGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
