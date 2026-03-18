import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class GuildConfigService extends Effect.Service<GuildConfigService>()("GuildConfigService", {
  effect: pipe(
    Effect.all({
      sheetApisClient: SheetApisClient,
    }),
    Effect.map(({ sheetApisClient }) => ({
      getAutoCheckinGuilds: Effect.fn("GuildConfigService.getAutoCheckinGuilds")(() =>
        sheetApisClient.get().guildConfig.getAutoCheckinGuilds(),
      ),
      getGuildConfigByGuildId: Effect.fn("GuildConfigService.getGuildConfigByGuildId")(
        (guildId: string) =>
          sheetApisClient.get().guildConfig.getGuildConfigByGuildId({ urlParams: { guildId } }),
      ),
      upsertGuildConfig: Effect.fn("GuildConfigService.upsertGuildConfig")(
        (
          guildId: string,
          config: {
            scriptId?: string | null | undefined;
            sheetId?: string | null | undefined;
            autoCheckin?: boolean | null | undefined;
          },
        ) =>
          sheetApisClient.get().guildConfig.upsertGuildConfig({
            payload: { guildId, config },
          }),
      ),
      getGuildMonitorRoles: Effect.fn("GuildConfigService.getGuildMonitorRoles")(
        (guildId: string) =>
          sheetApisClient.get().guildConfig.getGuildMonitorRoles({ urlParams: { guildId } }),
      ),
      addGuildMonitorRole: Effect.fn("GuildConfigService.addGuildMonitorRole")(
        (guildId: string, roleId: string) =>
          sheetApisClient.get().guildConfig.addGuildMonitorRole({ payload: { guildId, roleId } }),
      ),
      removeGuildMonitorRole: Effect.fn("GuildConfigService.removeGuildMonitorRole")(
        (guildId: string, roleId: string) =>
          sheetApisClient
            .get()
            .guildConfig.removeGuildMonitorRole({ payload: { guildId, roleId } }),
      ),
      upsertGuildChannelConfig: Effect.fn("GuildConfigService.upsertGuildChannelConfig")(
        (
          guildId: string,
          channelId: string,
          config: {
            name?: string | null | undefined;
            running?: boolean | null | undefined;
            roleId?: string | null | undefined;
            checkinChannelId?: string | null | undefined;
          },
        ) =>
          sheetApisClient.get().guildConfig.upsertGuildChannelConfig({
            payload: {
              guildId,
              channelId,
              config,
            },
          }),
      ),
      getGuildConfigByScriptId: Effect.fn("GuildConfigService.getGuildConfigByScriptId")(
        (scriptId: string) =>
          sheetApisClient.get().guildConfig.getGuildConfigByScriptId({ urlParams: { scriptId } }),
      ),
      getGuildChannelById: Effect.fn("GuildConfigService.getGuildChannelById")(
        (guildId: string, channelId: string, running?: boolean | undefined) =>
          sheetApisClient.get().guildConfig.getGuildChannelById({
            urlParams: {
              guildId,
              channelId,
              ...(typeof running === "undefined" ? {} : { running }),
            },
          }),
      ),
      getGuildChannelByName: Effect.fn("GuildConfigService.getGuildChannelByName")(
        (guildId: string, channelName: string, running?: boolean | undefined) =>
          sheetApisClient.get().guildConfig.getGuildChannelByName({
            urlParams: {
              guildId,
              channelName,
              ...(typeof running === "undefined" ? {} : { running }),
            },
          }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
