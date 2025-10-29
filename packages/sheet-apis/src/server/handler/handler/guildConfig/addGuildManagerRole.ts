import { addGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
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
      Event.someToken(),
      Effect.flatMap(AuthService.verify),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(addGuildManagerRoleHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap(({ guildId, roleId }) =>
        GuildConfigService.addGuildManagerRole(guildId, roleId),
      ),
      Error.Core.catchParseErrorAsValidationError,
      Handler.Config.encodeResponseEffect(addGuildManagerRoleHandlerConfig),
      Effect.withSpan("addGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
