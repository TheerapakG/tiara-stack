import { getGuildManagerRolesHandlerData } from "@/server/handler/data";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();
export const getGuildManagerRolesHandler = pipe(
  builders.empty(),
  builders.data(getGuildManagerRolesHandlerData),
  builders.handler(
    stripHandler(
      pipe(
        Effect.Do,
        Effect.tap(() => pipe(Event.someToken(), Effect.flatMap(AuthService.verify))),
        Effect.bind("parsed", () => Event.request.parsed(getGuildManagerRolesHandlerData)),
        Effect.flatMap(({ parsed }) => GuildConfigService.getGuildManagerRoles(parsed)),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Data.encodeResponseEffect(getGuildManagerRolesHandlerData)),
        Effect.withSpan("getGuildManagerRolesHandler", {
          captureStackTrace: true,
        }),
      ),
    ),
  ),
);
