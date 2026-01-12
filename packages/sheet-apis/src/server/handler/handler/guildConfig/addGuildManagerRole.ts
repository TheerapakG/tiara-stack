import { addGuildManagerRoleHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { UntilObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Mutation.builders();
export const addGuildManagerRoleHandler = pipe(
  builders.empty(),
  builders.data(addGuildManagerRoleHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Event.someToken(),
        Effect.flatMap(AuthService.verify),
        Effect.flatMap(() =>
          pipe(
            Event.request.parsed(addGuildManagerRoleHandlerData),
            Effect.flatMap(UntilObserver.observeOnce),
          ),
        ),
        Effect.flatMap(({ guildId, roleId }) =>
          GuildConfigService.addGuildManagerRole(guildId, roleId),
        ),
        Error.Core.catchParseErrorAsValidationError,
        Handler.Data.encodeResponseEffect(addGuildManagerRoleHandlerData),
        Effect.withSpan("addGuildManagerRoleHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
