import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { GuildConfigService } from "@/services/guildConfig";

export const GuildConfigLive = HttpApiBuilder.group(Api, "guildConfig", (handlers) =>
  pipe(
    Effect.all({
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ guildConfigService }) =>
      handlers
        .handle("getAutoCheckinGuilds", () => guildConfigService.getAutoCheckinGuilds())
        .handle("getGuildConfigByGuildId", ({ urlParams }) =>
          guildConfigService.getGuildConfigByGuildId(urlParams.guildId),
        )
        .handle("getGuildConfigByScriptId", ({ urlParams }) =>
          guildConfigService.getGuildConfigByScriptId(urlParams.scriptId),
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
          guildConfigService.getGuildRunningChannelById({
            guildId: urlParams.guildId,
            channelId: urlParams.channelId,
          }),
        )
        .handle("getGuildRunningChannelByName", ({ urlParams }) =>
          guildConfigService.getGuildRunningChannelByName({
            guildId: urlParams.guildId,
            channelName: urlParams.channelName,
          }),
        ),
    ),
  ),
).pipe(Layer.provide(GuildConfigService.Default));
