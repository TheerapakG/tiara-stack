import { Array, Effect, Layer, Option, ServiceMap, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { ZeroService } from "./zero";
import { GuildChannelConfig, GuildConfig, GuildConfigMonitorRole } from "@/schemas/guildConfig";

export class GuildConfigService extends ServiceMap.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    make: Effect.gen(function* () {
      const zeroService = yield* ZeroService;

      return {
        getAutoCheckinGuilds: Effect.fn("GuildConfigService.getAutoCheckinGuilds")(function* () {
          const result = yield* zeroService.run(queries.guildConfig.getAutoCheckinGuilds({}), {
            type: "complete",
          });
          return yield* Schema.decodeEffect(Schema.Array(DefaultTaggedClass(GuildConfig)))(result);
        }),
        getGuildConfig: Effect.fn("GuildConfigService.getGuildConfig")(function* (guildId: string) {
          const result = yield* zeroService.run(
            queries.guildConfig.getGuildConfigByGuildId({ guildId }),
            {
              type: "complete",
            },
          );
          return yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig)),
          )(result);
        }),
        upsertGuildConfig: Effect.fn("GuildConfigService.upsertGuildConfig")(function* (
          guildId: string,
          config: {
            sheetId?: string | null | undefined;
            autoCheckin?: boolean | null | undefined;
          },
        ) {
          const mutation = yield* zeroService.mutate(
            mutators.guildConfig.upsertGuildConfig({ guildId, ...config }),
          );
          yield* mutation.server();
          const result = yield* zeroService.run(
            queries.guildConfig.getGuildConfigByGuildId({ guildId }),
            {
              type: "complete",
            },
          );
          const guildConfig = yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig)),
          )(result);

          if (Option.isNone(guildConfig)) {
            return yield* Effect.die(makeDBQueryError("Failed to upsert guild config"));
          }

          return guildConfig.value;
        }),
        getGuildMonitorRoles: Effect.fn("GuildConfigService.getGuildMonitorRoles")(function* (
          guildId: string,
        ) {
          const result = yield* zeroService.run(
            queries.guildConfig.getGuildMonitorRoles({
              guildId,
            }),
            {
              type: "complete",
            },
          );
          return yield* Schema.decodeEffect(
            Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole)),
          )(result);
        }),
        getGuildChannels: Effect.fn("GuildConfigService.getGuildChannels")(function* (params: {
          guildId: string;
          running?: boolean | undefined;
        }) {
          const result = yield* zeroService.run(
            queries.guildConfig.getGuildChannels({
              guildId: params.guildId,
              ...(typeof params.running === "undefined" ? {} : { running: params.running }),
            }),
            { type: "complete" },
          );
          return yield* Schema.decodeEffect(Schema.Array(DefaultTaggedClass(GuildChannelConfig)))(
            result,
          );
        }),
        addGuildMonitorRole: Effect.fn("GuildConfigService.addGuildMonitorRole")(function* (
          guildId: string,
          roleId: string,
        ) {
          const mutation = yield* zeroService.mutate(
            mutators.guildConfig.addGuildMonitorRole({ guildId, roleId }),
          );
          yield* mutation.server();
          const result = yield* zeroService.run(
            queries.guildConfig.getGuildMonitorRoles({
              guildId,
            }),
            {
              type: "complete",
            },
          );
          const roles = yield* Schema.decodeEffect(
            Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole)),
          )(result);
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
          const mutation = yield* zeroService.mutate(
            mutators.guildConfig.removeGuildMonitorRole({ guildId, roleId }),
          );
          yield* mutation.server();
          const result = yield* zeroService.run(
            queries.guildConfig.getGuildMonitorRoles({
              guildId,
            }),
            {
              type: "complete",
            },
          );
          const roles = yield* Schema.decodeEffect(
            Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole)),
          )(result);
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
            const mutation = yield* zeroService.mutate(
              mutators.guildConfig.upsertGuildChannelConfig({
                guildId,
                channelId,
                name: config.name,
                running: config.running,
                roleId: config.roleId,
                checkinChannelId: config.checkinChannelId,
              }),
            );
            yield* mutation.server();
            const result = yield* zeroService.run(
              queries.guildConfig.getGuildChannelById({ guildId, channelId }),
              { type: "complete" },
            );
            const channel = yield* Schema.decodeEffect(
              Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig)),
            )(result);

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
            const result = yield* zeroService.run(
              queries.guildConfig.getGuildChannelById({
                guildId: params.guildId,
                channelId: params.channelId,
                ...(typeof params.running === "undefined" ? {} : { running: params.running }),
              }),
              { type: "complete" },
            );
            return yield* Schema.decodeEffect(
              Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig)),
            )(result);
          },
        ),
        getGuildChannelByName: Effect.fn("GuildConfigService.getGuildChannelByName")(
          function* (params: {
            guildId: string;
            channelName: string;
            running?: boolean | undefined;
          }) {
            const result = yield* zeroService.run(
              queries.guildConfig.getGuildChannelByName({
                guildId: params.guildId,
                channelName: params.channelName,
                ...(typeof params.running === "undefined" ? {} : { running: params.running }),
              }),
              { type: "complete" },
            );
            return yield* Schema.decodeEffect(
              Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig)),
            )(result);
          },
        ),
      };
    }),
  },
) {
  static layer = Layer.effect(GuildConfigService, this.make).pipe(Layer.provide(ZeroService.layer));
}
