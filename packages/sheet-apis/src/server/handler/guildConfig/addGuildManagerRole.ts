import { Effect, pipe, Schema } from "effect";
import { observeOnce } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import {
  AuthService,
  GuildConfigManagerRole,
  GuildConfigService,
} from "../../../services";

const responseSchema = Schema.OptionFromNullishOr(
  GuildConfigManagerRole,
  undefined,
);
export const addGuildManagerRoleHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.addGuildManagerRole")
  .type("mutation")
  .request({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
    validate: true,
  })
  .response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  })
  .build();

export const addGuildManagerRoleHandler = defineHandlerBuilder()
  .config(addGuildManagerRoleHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(addGuildManagerRoleHandlerConfig).request.parsed(),
          Effect.flatMap(observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.addGuildManagerRole(parsed.guildId, parsed.roleId),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("addGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  );
