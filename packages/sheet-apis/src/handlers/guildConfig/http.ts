import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError, makeArgumentError } from "typhoon-core/error";
import { GuildConfigService } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService } from "@/services";

export const guildConfigLayer = HttpApiBuilder.group(
  Api,
  "guildConfig",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const guildConfigService = yield* GuildConfigService;

    return handlers
      .handle("getAutoCheckinGuilds", () =>
        authorizationService
          .requireBot()
          .pipe(
            Effect.andThen(guildConfigService.getAutoCheckinGuilds()),
            catchSchemaErrorAsValidationError,
          ),
      )
      .handle("getGuildConfig", ({ query }) =>
        authorizationService
          .provideCurrentGuildUser(
            query.guildId,
            authorizationService.requireManageGuild(query.guildId).pipe(
              Effect.andThen(
                pipe(
                  guildConfigService.getGuildConfig(query.guildId),
                  Effect.flatMap(
                    Option.match({
                      onSome: (config) => Effect.succeed(config),
                      onNone: () =>
                        Effect.fail(
                          makeArgumentError(
                            "Cannot get guild config, the guild might not be registered",
                          ),
                        ),
                    }),
                  ),
                ),
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("upsertGuildConfig", ({ payload }) =>
        authorizationService
          .provideCurrentGuildUser(
            payload.guildId,
            authorizationService
              .requireManageGuild(payload.guildId)
              .pipe(
                Effect.andThen(
                  guildConfigService.upsertGuildConfig(payload.guildId, payload.config),
                ),
              ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getGuildMonitorRoles", ({ query }) =>
        guildConfigService
          .getGuildMonitorRoles(query.guildId)
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getGuildChannels", ({ query }) =>
        guildConfigService
          .getGuildChannels({
            guildId: query.guildId,
            ...(typeof query.running === "undefined" ? {} : { running: query.running }),
          })
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("addGuildMonitorRole", ({ payload }) =>
        authorizationService
          .provideCurrentGuildUser(
            payload.guildId,
            authorizationService
              .requireManageGuild(payload.guildId)
              .pipe(
                Effect.andThen(
                  guildConfigService.addGuildMonitorRole(payload.guildId, payload.roleId),
                ),
              ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("removeGuildMonitorRole", ({ payload }) =>
        authorizationService
          .provideCurrentGuildUser(
            payload.guildId,
            authorizationService
              .requireManageGuild(payload.guildId)
              .pipe(
                Effect.andThen(
                  guildConfigService.removeGuildMonitorRole(payload.guildId, payload.roleId),
                ),
              ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("upsertGuildChannelConfig", ({ payload }) =>
        authorizationService
          .provideCurrentGuildUser(
            payload.guildId,
            authorizationService
              .requireManageGuild(payload.guildId)
              .pipe(
                Effect.andThen(
                  guildConfigService.upsertGuildChannelConfig(
                    payload.guildId,
                    payload.channelId,
                    payload.config,
                  ),
                ),
              ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getGuildChannelById", ({ query }) =>
        pipe(
          guildConfigService.getGuildChannelById({
            guildId: query.guildId,
            channelId: query.channelId,
            running: query.running,
          }),
          Effect.flatMap(
            Option.match({
              onSome: (config) => Effect.succeed(config),
              onNone: () =>
                Effect.fail(
                  makeArgumentError(
                    typeof query.running === "undefined"
                      ? "Cannot get channel by id, the guild or the channel id might not be registered"
                      : "Cannot get channel by id, the guild or the channel id might not be registered or does not match the specified running status",
                  ),
                ),
            }),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getGuildChannelByName", ({ query }) =>
        pipe(
          guildConfigService.getGuildChannelByName({
            guildId: query.guildId,
            channelName: query.channelName,
            running: query.running,
          }),
          Effect.flatMap(
            Option.match({
              onSome: (config) => Effect.succeed(config),
              onNone: () =>
                Effect.fail(
                  makeArgumentError(
                    typeof query.running === "undefined"
                      ? "Cannot get channel by name, the guild or the channel name might not be registered"
                      : "Cannot get channel by name, the guild or the channel name might not be registered or does not match the specified running status",
                  ),
                ),
            }),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
