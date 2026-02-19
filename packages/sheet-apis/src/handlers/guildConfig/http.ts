import { HttpApiBuilder } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { GuildConfigService } from "@/services/guildConfig";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

export const GuildConfigLive = HttpApiBuilder.group(Api, "guildConfig", (handlers) =>
  pipe(
    Effect.all({
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ guildConfigService }) =>
      handlers
        .handle("getAutoCheckinGuilds", () => guildConfigService.getAutoCheckinGuilds())
        .handle("getGuildConfigByGuildId", ({ urlParams }) =>
          pipe(
            guildConfigService.getGuildConfigByGuildId(urlParams.guildId),
            Effect.flatMap(
              Option.match({
                onSome: (config) => Effect.succeed(config),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError("Cannot get guild config, the guild might not be registered"),
                  ),
              }),
            ),
          ),
        )
        .handle("getGuildConfigByScriptId", ({ urlParams }) =>
          pipe(
            guildConfigService.getGuildConfigByScriptId(urlParams.scriptId),
            Effect.flatMap(
              Option.match({
                onSome: (config) => Effect.succeed(config),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      "Cannot get guild config by script id, the script id might not be registered",
                    ),
                  ),
              }),
            ),
          ),
        )
        .handle("upsertGuildConfig", ({ payload }) =>
          guildConfigService.upsertGuildConfig(payload.guildId, payload.config),
        )
        .handle("getGuildManagerRoles", ({ urlParams }) =>
          guildConfigService.getGuildManagerRoles(urlParams.guildId),
        )
        .handle("addGuildManagerRole", ({ payload }) =>
          guildConfigService.addGuildManagerRole(payload.guildId, payload.roleId),
        )
        .handle("removeGuildManagerRole", ({ payload }) =>
          guildConfigService.removeGuildManagerRole(payload.guildId, payload.roleId),
        )
        .handle("upsertGuildChannelConfig", ({ payload }) =>
          guildConfigService.upsertGuildChannelConfig(
            payload.guildId,
            payload.channelId,
            payload.config,
          ),
        )
        .handle("getGuildRunningChannelById", ({ urlParams }) =>
          pipe(
            guildConfigService.getGuildRunningChannelById({
              guildId: urlParams.guildId,
              channelId: urlParams.channelId,
            }),
            Effect.flatMap(
              Option.match({
                onSome: (config) => Effect.succeed(config),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      "Cannot get running channel by id, the guild or the channel id might not be registered",
                    ),
                  ),
              }),
            ),
          ),
        )
        .handle("getGuildRunningChannelByName", ({ urlParams }) =>
          pipe(
            guildConfigService.getGuildRunningChannelByName({
              guildId: urlParams.guildId,
              channelName: urlParams.channelName,
            }),
            Effect.flatMap(
              Option.match({
                onSome: (config) => Effect.succeed(config),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      "Cannot get running channel by name, the guild or the channel name might not be registered",
                    ),
                  ),
              }),
            ),
          ),
        ),
    ),
  ),
).pipe(Layer.provide(Layer.mergeAll(GuildConfigService.Default, SheetAuthTokenAuthorizationLive)));
