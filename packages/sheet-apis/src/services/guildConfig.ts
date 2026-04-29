import { Array, Effect, Layer, Option, Context } from "effect";
import { makeDBQueryError } from "typhoon-core/error";
import { SheetZeroClient } from "./sheetZeroClient";

export class GuildConfigService extends Context.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    make: Effect.gen(function* () {
      const zero = yield* SheetZeroClient;

      return {
        getAutoCheckinGuilds: Effect.fn("GuildConfigService.getAutoCheckinGuilds")(function* () {
          return yield* zero.guildConfig.getAutoCheckinGuilds({});
        }),
        getGuildConfig: Effect.fn("GuildConfigService.getGuildConfig")(function* (guildId: string) {
          return yield* zero.guildConfig.getGuildConfigByGuildId({ guildId });
        }),
        upsertGuildConfig: Effect.fn("GuildConfigService.upsertGuildConfig")(function* (
          guildId: string,
          config: {
            sheetId?: string | null | undefined;
            autoCheckin?: boolean | null | undefined;
          },
        ) {
          yield* zero.guildConfig.upsertGuildConfig({ guildId, ...config });
          const guildConfig = yield* zero.guildConfig.getGuildConfigByGuildId({ guildId });

          if (Option.isNone(guildConfig)) {
            return yield* Effect.die(makeDBQueryError("Failed to upsert guild config"));
          }

          return guildConfig.value;
        }),
        getGuildMonitorRoles: Effect.fn("GuildConfigService.getGuildMonitorRoles")(function* (
          guildId: string,
        ) {
          return yield* zero.guildConfig.getGuildMonitorRoles({ guildId });
        }),
        getGuildChannels: Effect.fn("GuildConfigService.getGuildChannels")(function* (params: {
          guildId: string;
          running?: boolean | undefined;
        }) {
          return yield* zero.guildConfig.getGuildChannels({
            guildId: params.guildId,
            ...(typeof params.running === "undefined" ? {} : { running: params.running }),
          });
        }),
        addGuildMonitorRole: Effect.fn("GuildConfigService.addGuildMonitorRole")(function* (
          guildId: string,
          roleId: string,
        ) {
          yield* zero.guildConfig.addGuildMonitorRole({ guildId, roleId });
          const roles = yield* zero.guildConfig.getGuildMonitorRoles({ guildId });
          const role = Array.findFirst(roles, (item) => item.roleId === roleId);

          if (Option.isNone(role)) {
            return yield* Effect.die(makeDBQueryError("Failed to add guild monitor role"));
          }

          return role.value;
        }),
        removeGuildMonitorRole: Effect.fn("GuildConfigService.removeGuildMonitorRole")(function* (
          guildId: string,
          roleId: string,
        ) {
          yield* zero.guildConfig.removeGuildMonitorRole({ guildId, roleId });
          const roles = yield* zero.guildConfig.getGuildMonitorRoles({ guildId });
          const role = Array.findFirst(roles, (item) => item.roleId === roleId);

          if (Option.isNone(role)) {
            return yield* Effect.die(makeDBQueryError("Failed to remove guild monitor role"));
          }

          return role.value;
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
            yield* zero.guildConfig.upsertGuildChannelConfig({
              guildId,
              channelId,
              name: config.name,
              running: config.running,
              roleId: config.roleId,
              checkinChannelId: config.checkinChannelId,
            });
            const channel = yield* zero.guildConfig.getGuildChannelById({ guildId, channelId });

            if (Option.isNone(channel)) {
              return yield* Effect.die(makeDBQueryError("Failed to upsert guild channel config"));
            }

            return channel.value;
          },
        ),
        getGuildChannelById: Effect.fn("GuildConfigService.getGuildChannelById")(
          function* (params: {
            guildId: string;
            channelId: string;
            running?: boolean | undefined;
          }) {
            return yield* zero.guildConfig.getGuildChannelById({
              guildId: params.guildId,
              channelId: params.channelId,
              ...(typeof params.running === "undefined" ? {} : { running: params.running }),
            });
          },
        ),
        getGuildChannelByName: Effect.fn("GuildConfigService.getGuildChannelByName")(
          function* (params: {
            guildId: string;
            channelName: string;
            running?: boolean | undefined;
          }) {
            return yield* zero.guildConfig.getGuildChannelByName({
              guildId: params.guildId,
              channelName: params.channelName,
              ...(typeof params.running === "undefined" ? {} : { running: params.running }),
            });
          },
        ),
      };
    }),
  },
) {
  static layer = Layer.effect(GuildConfigService, this.make).pipe(
    Layer.provide(SheetZeroClient.layer),
  );
}
