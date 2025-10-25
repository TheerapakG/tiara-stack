import { getGuildManagerRolesHandlerConfig } from "@/server/handler/config";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const getGuildManagerRolesHandler = pipe(
  builders.empty(),
  builders.data(getGuildManagerRolesHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildManagerRolesHandlerConfig),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildManagerRoles(parsed),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(
        Schema.encodeEither(
          Handler.Config.resolveResponseValidator(
            Handler.Config.response(getGuildManagerRolesHandlerConfig),
          ),
        ),
      ),
      Effect.withSpan("getGuildManagerRolesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
