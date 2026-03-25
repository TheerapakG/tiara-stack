import { Array, Context, Effect, Option, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { catchParseErrorAsValidationError } from "typhoon-core/error";
import { ZeroService } from "typhoon-core/services";
import { ZeroLive } from "./zero";
import { type Schema as ZeroSchema } from "sheet-db-schema/zero";
import { GuildChannelConfig, GuildConfig, GuildConfigMonitorRole } from "@/schemas/guildConfig";

export class GuildConfigService extends Effect.Service<GuildConfigService>()("GuildConfigService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("zeroContext", () =>
      pipe(
        Effect.context<ZeroService.ZeroService<ZeroSchema, any, any>>(),
        Effect.map(Context.pick(ZeroService.ZeroService<ZeroSchema, any, any>())),
      ),
    ),
    Effect.map(({ zeroContext }) => ({
      getAutoCheckinGuilds: () =>
        pipe(
          ZeroService.run(queries.guildConfig.getAutoCheckinGuilds({}), { type: "complete" }),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfig)))),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getAutoCheckinGuilds", {
            captureStackTrace: true,
          }),
        ),
      getGuildConfig: (guildId: string) =>
        pipe(
          ZeroService.run(queries.guildConfig.getGuildConfigByGuildId({ guildId }), {
            type: "complete",
          }),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined)),
          ),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildConfig", {
            captureStackTrace: true,
          }),
        ),
      upsertGuildConfig: (
        guildId: string,
        config: {
          sheetId?: string | null | undefined;
          autoCheckin?: boolean | null | undefined;
        },
      ) =>
        pipe(
          ZeroService.mutate(mutators.guildConfig.upsertGuildConfig({ guildId, ...config })),
          Effect.andThen((mutation) => mutation.server()),
          Effect.andThen(
            ZeroService.run(queries.guildConfig.getGuildConfigByGuildId({ guildId }), {
              type: "complete",
            }),
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined)),
          ),
          catchParseErrorAsValidationError,
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(makeDBQueryError("Failed to upsert guild config")),
            }),
          ),
          Effect.withSpan("GuildConfigService.upsertGuildConfig", {
            captureStackTrace: true,
          }),
        ),
      getGuildMonitorRoles: (guildId: string) =>
        pipe(
          ZeroService.run(queries.guildConfig.getGuildMonitorRoles({ guildId }), {
            type: "complete",
          }),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole)))),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildMonitorRoles", {
            captureStackTrace: true,
          }),
        ),
      getGuildChannels: (params: { guildId: string; running?: boolean | undefined }) =>
        pipe(
          ZeroService.run(
            queries.guildConfig.getGuildChannels({
              guildId: params.guildId,
              ...(typeof params.running === "undefined" ? {} : { running: params.running }),
            }),
            { type: "complete" },
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildChannelConfig)))),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildChannels", {
            captureStackTrace: true,
          }),
        ),
      addGuildMonitorRole: (guildId: string, roleId: string) =>
        pipe(
          ZeroService.mutate(mutators.guildConfig.addGuildMonitorRole({ guildId, roleId })),
          Effect.andThen((mutation) => mutation.server()),
          Effect.andThen(
            ZeroService.run(queries.guildConfig.getGuildMonitorRoles({ guildId }), {
              type: "complete",
            }),
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole)))),
          catchParseErrorAsValidationError,
          Effect.map(Array.findFirst((role) => role.roleId === roleId)),
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(makeDBQueryError("Failed to add guild monitor role")),
            }),
          ),
          Effect.withSpan("GuildConfigService.addGuildMonitorRole", {
            captureStackTrace: true,
          }),
        ),
      removeGuildMonitorRole: (guildId: string, roleId: string) =>
        pipe(
          ZeroService.mutate(mutators.guildConfig.removeGuildMonitorRole({ guildId, roleId })),
          Effect.andThen((mutation) => mutation.server()),
          Effect.andThen(
            ZeroService.run(queries.guildConfig.getGuildMonitorRoles({ guildId }), {
              type: "complete",
            }),
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfigMonitorRole)))),
          catchParseErrorAsValidationError,
          Effect.map(Array.findFirst((role) => role.roleId === roleId)),
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(makeDBQueryError("Failed to remove guild monitor role")),
            }),
          ),
          Effect.withSpan("GuildConfigService.removeGuildMonitorRole", {
            captureStackTrace: true,
          }),
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
          ZeroService.mutate(
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
            ZeroService.run(queries.guildConfig.getGuildChannelById({ guildId, channelId }), {
              type: "complete",
            }),
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(
              Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig), undefined),
            ),
          ),
          catchParseErrorAsValidationError,
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(makeDBQueryError("Failed to upsert guild channel config")),
            }),
          ),
          Effect.withSpan("GuildConfigService.upsertGuildChannelConfig", {
            captureStackTrace: true,
          }),
        ),
      getGuildChannelById: (params: {
        guildId: string;
        channelId: string;
        running?: boolean | undefined;
      }) =>
        pipe(
          ZeroService.run(
            queries.guildConfig.getGuildChannelById({
              guildId: params.guildId,
              channelId: params.channelId,
              ...(typeof params.running === "undefined" ? {} : { running: params.running }),
            }),
            { type: "complete" },
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(
              Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig), undefined),
            ),
          ),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildChannelById", {
            captureStackTrace: true,
          }),
        ),
      getGuildChannelByName: (params: {
        guildId: string;
        channelName: string;
        running?: boolean | undefined;
      }) =>
        pipe(
          ZeroService.run(
            queries.guildConfig.getGuildChannelByName({
              guildId: params.guildId,
              channelName: params.channelName,
              ...(typeof params.running === "undefined" ? {} : { running: params.running }),
            }),
            { type: "complete" },
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(
              Schema.OptionFromNullishOr(DefaultTaggedClass(GuildChannelConfig), undefined),
            ),
          ),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildChannelByName", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [ZeroLive],
  accessors: true,
}) {}
