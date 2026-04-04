import { Effect, Layer, ServiceMap } from "effect";
import { SheetApisClient } from "./sheetApis";

export class GuildConfigService extends ServiceMap.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    make: Effect.gen(function* () {
      const sheetApisClient = yield* SheetApisClient;

      return {
        getAutoCheckinGuilds: Effect.fn("GuildConfigService.getAutoCheckinGuilds")(function* () {
          return yield* sheetApisClient.get().guildConfig.getAutoCheckinGuilds();
        }),
        getGuildConfig: Effect.fn("GuildConfigService.getGuildConfig")(function* (guildId: string) {
          return yield* sheetApisClient.get().guildConfig.getGuildConfig({ query: { guildId } });
        }),
        upsertGuildConfig: Effect.fn("GuildConfigService.upsertGuildConfig")(function* (
          guildId: string,
          config: {
            sheetId?: string | null | undefined;
            autoCheckin?: boolean | null | undefined;
          },
        ) {
          return yield* sheetApisClient.get().guildConfig.upsertGuildConfig({
            payload: { guildId, config },
          });
        }),
        getGuildMonitorRoles: Effect.fn("GuildConfigService.getGuildMonitorRoles")(function* (
          guildId: string,
        ) {
          return yield* sheetApisClient.get().guildConfig.getGuildMonitorRoles({
            query: { guildId },
          });
        }),
        getGuildChannels: Effect.fn("GuildConfigService.getGuildChannels")(function* (
          guildId: string,
          running?: boolean,
        ) {
          return yield* sheetApisClient.get().guildConfig.getGuildChannels({
            query: {
              guildId,
              ...(typeof running === "undefined" ? {} : { running }),
            },
          });
        }),
        addGuildMonitorRole: Effect.fn("GuildConfigService.addGuildMonitorRole")(function* (
          guildId: string,
          roleId: string,
        ) {
          return yield* sheetApisClient.get().guildConfig.addGuildMonitorRole({
            payload: { guildId, roleId },
          });
        }),
        removeGuildMonitorRole: Effect.fn("GuildConfigService.removeGuildMonitorRole")(function* (
          guildId: string,
          roleId: string,
        ) {
          return yield* sheetApisClient.get().guildConfig.removeGuildMonitorRole({
            payload: { guildId, roleId },
          });
        }),
        upsertGuildChannelConfig: Effect.fn("GuildConfigService.upsertGuildChannelConfig")(
          function* (
            guildId: string,
            channelId: string,
            config: {
              name?: string | null | undefined;
              running?: boolean | null | undefined;
              roleId?: string | null | undefined;
              checkinChannelId?: string | null | undefined;
            },
          ) {
            return yield* sheetApisClient.get().guildConfig.upsertGuildChannelConfig({
              payload: {
                guildId,
                channelId,
                config,
              },
            });
          },
        ),
        getGuildChannelById: Effect.fn("GuildConfigService.getGuildChannelById")(function* (
          guildId: string,
          channelId: string,
          running?: boolean,
        ) {
          return yield* sheetApisClient.get().guildConfig.getGuildChannelById({
            query: {
              guildId,
              channelId,
              ...(typeof running === "undefined" ? {} : { running }),
            },
          });
        }),
        getGuildChannelByName: Effect.fn("GuildConfigService.getGuildChannelByName")(function* (
          guildId: string,
          channelName: string,
          running?: boolean,
        ) {
          return yield* sheetApisClient.get().guildConfig.getGuildChannelByName({
            query: {
              guildId,
              channelName,
              ...(typeof running === "undefined" ? {} : { running }),
            },
          });
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(GuildConfigService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
  );
}
