import { getGuildManagerRolesHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getGuildManagerRolesHandler = pipe(
  builders.empty(),
  builders.data(getGuildManagerRolesHandlerConfig),
  builders.handler(
    pipe(
      Effect.Do,
      Effect.tap(() =>
        pipe(Event.someToken(), Effect.flatMap(AuthService.verify)),
      ),
      Effect.bind("parsed", () =>
        Event.request.parsed(getGuildManagerRolesHandlerConfig),
      ),
      Effect.flatMap(({ parsed }) =>
        GuildConfigService.getGuildManagerRoles(parsed),
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
