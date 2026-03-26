import { HttpApiBuilder } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import {
  provideCurrentGuildUser,
  requireBot,
  requireManageGuild,
} from "@/middlewares/authorization";
import { GuildConfigService } from "@/services/guildConfig";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

export const GuildConfigLive = HttpApiBuilder.group(Api, "guildConfig", (handlers) =>
  pipe(
    Effect.all({
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ guildConfigService }) =>
      handlers
        .handle("getAutoCheckinGuilds", () =>
          requireBot().pipe(Effect.andThen(guildConfigService.getAutoCheckinGuilds())),
        )
        .handle("getGuildConfig", ({ urlParams }) =>
          provideCurrentGuildUser(
            urlParams.guildId,
            requireManageGuild(urlParams.guildId).pipe(
              Effect.andThen(
                pipe(
                  guildConfigService.getGuildConfig(urlParams.guildId),
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
          ),
        )
        .handle("upsertGuildConfig", ({ payload }) =>
          provideCurrentGuildUser(
            payload.guildId,
            requireManageGuild(payload.guildId).pipe(
              Effect.andThen(guildConfigService.upsertGuildConfig(payload.guildId, payload.config)),
            ),
          ),
        )
        .handle("getGuildMonitorRoles", ({ urlParams }) =>
          // Monitor role IDs are intentionally readable by any authenticated caller;
          // they are guild role definitions consumed by the authorization layer itself.
          guildConfigService.getGuildMonitorRoles(urlParams.guildId),
        )
        .handle("getGuildChannels", ({ urlParams }) =>
          // Channel listings are intentionally available to any authenticated caller;
          // only the guild sheet binding in `getGuildConfig` remains manage-gated.
          guildConfigService.getGuildChannels({
            guildId: urlParams.guildId,
            ...(typeof urlParams.running === "undefined" ? {} : { running: urlParams.running }),
          }),
        )
        .handle("addGuildMonitorRole", ({ payload }) =>
          provideCurrentGuildUser(
            payload.guildId,
            requireManageGuild(payload.guildId).pipe(
              Effect.andThen(
                guildConfigService.addGuildMonitorRole(payload.guildId, payload.roleId),
              ),
            ),
          ),
        )
        .handle("removeGuildMonitorRole", ({ payload }) =>
          provideCurrentGuildUser(
            payload.guildId,
            requireManageGuild(payload.guildId).pipe(
              Effect.andThen(
                guildConfigService.removeGuildMonitorRole(payload.guildId, payload.roleId),
              ),
            ),
          ),
        )
        .handle("upsertGuildChannelConfig", ({ payload }) =>
          provideCurrentGuildUser(
            payload.guildId,
            requireManageGuild(payload.guildId).pipe(
              Effect.andThen(
                guildConfigService.upsertGuildChannelConfig(
                  payload.guildId,
                  payload.channelId,
                  payload.config,
                ),
              ),
            ),
          ),
        )
        .handle("getGuildChannelById", ({ urlParams }) =>
          // Channel read endpoints are intentionally available to any authenticated caller;
          // only the guild sheet binding in `getGuildConfig` remains manage-gated.
          pipe(
            guildConfigService.getGuildChannelById({
              guildId: urlParams.guildId,
              channelId: urlParams.channelId,
              running: urlParams.running,
            }),
            Effect.flatMap(
              Option.match({
                onSome: (config) => Effect.succeed(config),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      typeof urlParams.running === "undefined"
                        ? "Cannot get channel by id, the guild or the channel id might not be registered"
                        : "Cannot get channel by id, the guild or the channel id might not be registered or does not match the specified running status",
                    ),
                  ),
              }),
            ),
          ),
        )
        .handle("getGuildChannelByName", ({ urlParams }) =>
          // Channel read endpoints are intentionally available to any authenticated caller;
          // only the guild sheet binding in `getGuildConfig` remains manage-gated.
          pipe(
            guildConfigService.getGuildChannelByName({
              guildId: urlParams.guildId,
              channelName: urlParams.channelName,
              running: urlParams.running,
            }),
            Effect.flatMap(
              Option.match({
                onSome: (config) => Effect.succeed(config),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      typeof urlParams.running === "undefined"
                        ? "Cannot get channel by name, the guild or the channel name might not be registered"
                        : "Cannot get channel by name, the guild or the channel name might not be registered or does not match the specified running status",
                    ),
                  ),
              }),
            ),
          ),
        ),
    ),
  ),
).pipe(Layer.provide(Layer.mergeAll(GuildConfigService.Default, SheetAuthTokenAuthorizationLive)));
