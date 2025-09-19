import { getGuildManagerRolesHandlerConfig } from "@/server/handler/config";
import { GuildConfigManagerRole } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/server";

const responseSchema = Schema.Array(GuildConfigManagerRole);

export const getGuildManagerRolesHandler = pipe(
  HandlerContextConfig.empty,
  HandlerContextConfig.Builder.config(getGuildManagerRolesHandlerConfig),
  HandlerContextConfig.Builder.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildManagerRolesHandlerConfig),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildManagerRoles(parsed),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("getGuildManagerRolesHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
