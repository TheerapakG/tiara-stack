import { removeGuildManagerRoleHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Option, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();
export const removeGuildManagerRoleHandler = pipe(
  builders.empty(),
  builders.data(removeGuildManagerRoleHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(removeGuildManagerRoleHandlerData),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ guildId, roleId }) =>
          GuildConfigService.removeGuildManagerRole(guildId, roleId),
        ),
        Effect.flatMap(
          Option.match({
            onSome: Effect.succeed,
            onNone: () =>
              Effect.fail(
                Error.Core.makeArgumentError(
                  "Cannot remove guild manager role, the guild might not be registered, or the role is not a manager role",
                ),
              ),
          }),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Data.encodeResponseEffect(removeGuildManagerRoleHandlerData),
        Effect.withSpan("removeGuildManagerRoleHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
