import { Effect, Function, pipe, Schema } from "effect";
import { computed, Computed } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import {
  AuthService,
  GuildConfigManagerRole,
  GuildConfigService,
} from "../../../services";

const responseSchema = Schema.Array(GuildConfigManagerRole);
export const getGuildManagerRolesHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.getGuildManagerRoles")
  .type("subscription")
  .request({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();

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
