import { getGuildManagerRolesHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, flow, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getGuildManagerRolesHandler = pipe(
  builders.empty(),
  builders.data(getGuildManagerRolesHandlerConfig),
  builders.handler(
    pipe(
      Effect.succeed(Event.someToken()),
      Effect.map(Effect.flatMap(AuthService.verify)),
      Effect.map(
        flow(
          Effect.flatMap(() =>
            Event.request.parsedWithScope(getGuildManagerRolesHandlerConfig),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(
        flow(
          Effect.flatMap(({ parsed, scope }) =>
            pipe(
              GuildConfigService.getGuildManagerRoles(parsed),
              Scope.extend(scope),
            ),
          ),
          Effect.flatten,
        ),
      ),
      Effect.map(Error.Core.catchParseErrorAsValidationError),
      Effect.map(
        Handler.Config.encodeResponseEffect(getGuildManagerRolesHandlerConfig),
      ),
      Effect.withSpan("getGuildManagerRolesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
