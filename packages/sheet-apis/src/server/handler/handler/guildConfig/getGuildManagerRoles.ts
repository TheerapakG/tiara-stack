import { getGuildManagerRolesHandlerConfig } from "@/server/handler/config";
import { GuildConfigManagerRole } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { computed, Computed } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

const responseSchema = Schema.Array(GuildConfigManagerRole);

export const getGuildManagerRolesHandler = defineHandlerBuilder()
  .config(getGuildManagerRolesHandlerConfig)
  .handler(
    pipe(
      computed(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.withConfig(getGuildManagerRolesHandlerConfig).request.parsed(),
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
  );
