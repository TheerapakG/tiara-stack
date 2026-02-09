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
      getGuildManagerRoles: Effect.fn("GuildConfigService.getGuildManagerRoles")(
        (guildId: string) =>
          sheetApisClient.get().guildConfig.getGuildManagerRoles({ urlParams: { guildId } }),
      ),
      addGuildManagerRole: Effect.fn("GuildConfigService.addGuildManagerRole")(
        (guildId: string, roleId: string) =>
          sheetApisClient.get().guildConfig.addGuildManagerRole({ payload: { guildId, roleId } }),
      ),
      removeGuildManagerRole: Effect.fn("GuildConfigService.removeGuildManagerRole")(
        (guildId: string, roleId: string) =>
          sheetApisClient
            .get()
            .guildConfig.removeGuildManagerRole({ payload: { guildId, roleId } }),
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
      getGuildRunningChannelById: Effect.fn("GuildConfigService.getGuildRunningChannelById")(
        (guildId: string, channelId: string) =>
          sheetApisClient
            .get()
            .guildConfig.getGuildRunningChannelById({ urlParams: { guildId, channelId } }),
      ),
      getGuildRunningChannelByName: Effect.fn("GuildConfigService.getGuildRunningChannelByName")(
        (guildId: string, channelName: string) =>
          sheetApisClient
            .get()
            .guildConfig.getGuildRunningChannelByName({ urlParams: { guildId, channelName } }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
