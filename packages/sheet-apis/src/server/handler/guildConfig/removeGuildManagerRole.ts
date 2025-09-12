import { Effect, pipe, Schema } from "effect";
import { observeOnce } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import {
  AuthService,
  GuildConfigManagerRole,
  GuildConfigService,
} from "../../../services";

const responseSchema = Schema.Array(GuildConfigManagerRole);
export const removeGuildManagerRoleHandlerConfig = defineHandlerConfigBuilder()
  .name("guildConfig.removeGuildManagerRole")
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

export const removeGuildManagerRoleHandler = defineHandlerBuilder()
  .config(removeGuildManagerRoleHandlerConfig)
  .handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.withConfig(
            removeGuildManagerRoleHandlerConfig,
          ).request.parsed(),
          Effect.flatMap(observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.removeGuildManagerRole(
          parsed.guildId,
          parsed.roleId,
        ),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("removeGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  );
