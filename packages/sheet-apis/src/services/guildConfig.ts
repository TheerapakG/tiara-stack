import { Array, Effect, Layer, Option, ServiceMap, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { catchSchemaErrorAsValidationError, makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { ZeroService } from "./zero";
import { GuildChannelConfig, GuildConfig, GuildConfigMonitorRole } from "@/schemas/guildConfig";

export class GuildConfigService extends ServiceMap.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    make: Effect.gen(function* () {
      const zeroService = yield* ZeroService;

      return {
        getAutoCheckinGuilds: () =>
          pipe(
            zeroService.run(queries.guildConfig.getAutoCheckinGuilds({}), { type: "complete" }),
            Effect.flatMap(Schema.decodeEffect(Schema.Array(DefaultTaggedClass(GuildConfig)))),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("GuildConfigService.getAutoCheckinGuilds"),
          ),
        getGuildConfig: (guildId: string) =>
          pipe(
            zeroService.run(queries.guildConfig.getGuildConfigByGuildId({ guildId }), {
              type: "complete",
            }),
            Effect.flatMap(
              Schema.decodeEffect(
                Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("GuildConfigService.getGuildConfig"),
          ),
        upsertGuildConfig: (
          guildId: string,
          config: {
            sheetId?: string | null | undefined;
            autoCheckin?: boolean | null | undefined;
          },
        ) =>
          pipe(
            zeroService.mutate(mutators.guildConfig.upsertGuildConfig({ guildId, ...config })),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.guildConfig.getGuildConfigByGuildId({ guildId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(
                Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to upsert guild config")),
              }),
            ),
            Effect.withSpan("GuildConfigService.upsertGuildConfig"),
          ),
        getGuildMonitorRoles: (guildId: string) =>
          pipe(
            zeroService.run(queries.guildConfig.getGuildMonitorRoles({ guildId }), {
              type: "complete",
            }),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("GuildConfigService.getGuildMonitorRoles"),
          ),
        getGuildChannels: (params: { guildId: string; running?: boolean | undefined }) =>
          pipe(
            zeroService.run(
              queries.guildConfig.getGuildChannels({
                guildId: params.guildId,
                ...(typeof params.running === "undefined" ? {} : { running: params.running }),
              }),
              { type: "complete" },
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(GuildChannelConfig))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("GuildConfigService.getGuildChannels"),
          ),
        addGuildMonitorRole: (guildId: string, roleId: string) =>
          pipe(
            zeroService.mutate(mutators.guildConfig.addGuildMonitorRole({ guildId, roleId })),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.guildConfig.getGuildMonitorRoles({ guildId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.map(Array.findFirst((role) => role.roleId === roleId)),
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to add guild monitor role")),
              }),
            ),
            Effect.withSpan("GuildConfigService.addGuildMonitorRole"),
          ),
        removeGuildMonitorRole: (guildId: string, roleId: string) =>
          pipe(
            zeroService.mutate(mutators.guildConfig.removeGuildMonitorRole({ guildId, roleId })),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.guildConfig.getGuildMonitorRoles({ guildId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.map(Array.findFirst((role) => role.roleId === roleId)),
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to remove guild monitor role")),
              }),
            ),
            Effect.withSpan("GuildConfigService.removeGuildMonitorRole"),
          ),
        upsertGuildChannelConfig: (
          guildId: string,
          channelId: string,
          config: {
            name?: string | null | undefined;
            running?: boolean | null | undefined;
            roleId?: string | null | undefined;
            checkinChannelId?: string | null | undefined;
          },
        ) =>
          pipe(
            zeroService.mutate(
              mutators.guildConfig.upsertGuildChannelConfig({
                guildId,
                channelId,
                name: config.name,
                running: config.running,
                roleId: config.roleId,
                checkinChannelId: config.checkinChannelId,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.guildConfig.getGuildChannelById({ guildId, channelId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(
                Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig), undefined),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to upsert guild channel config")),
              }),
            ),
            Effect.withSpan("GuildConfigService.upsertGuildChannelConfig"),
          ),
        getGuildChannelById: (params: {
          guildId: string;
          channelId: string;
          running?: boolean | undefined;
        }) =>
          pipe(
            zeroService.run(
              queries.guildConfig.getGuildChannelById({
                guildId: params.guildId,
                channelId: params.channelId,
                ...(typeof params.running === "undefined" ? {} : { running: params.running }),
              }),
              { type: "complete" },
            ),
            Effect.flatMap(
              Schema.decodeEffect(
                Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig), undefined),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("GuildConfigService.getGuildChannelById"),
          ),
        getGuildChannelByName: (params: {
          guildId: string;
          channelName: string;
          running?: boolean | undefined;
        }) =>
          pipe(
            zeroService.run(
              queries.guildConfig.getGuildChannelByName({
                guildId: params.guildId,
                channelName: params.channelName,
                ...(typeof params.running === "undefined" ? {} : { running: params.running }),
              }),
              { type: "complete" },
            ),
            Effect.flatMap(
              Schema.decodeEffect(
                Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig), undefined),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("GuildConfigService.getGuildChannelByName"),
          ),
      };
    }),
  },
) {
  static layer = Layer.effect(GuildConfigService, this.make).pipe(Layer.provide(ZeroService.layer));
}
