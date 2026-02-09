import { Array, Context, Effect, Option, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { catchParseErrorAsValidationError } from "typhoon-core/error";
import { ZeroService } from "typhoon-core/services";
import { ZeroLive } from "./zero";
import { type Schema as ZeroSchema } from "sheet-db-schema/zero";
import { GuildChannelConfig, GuildConfig, GuildConfigManagerRole } from "@/schemas/guildConfig";

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
      getGuildConfigByGuildId: (guildId: string) =>
        pipe(
          ZeroService.run(queries.guildConfig.getGuildConfigByGuildId({ guildId }), {
            type: "complete",
          }),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined)),
          ),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildConfigByGuildId", {
            captureStackTrace: true,
          }),
        ),
      getGuildConfigByScriptId: (scriptId: string) =>
        pipe(
          ZeroService.run(queries.guildConfig.getGuildConfigByScriptId({ scriptId }), {
            type: "complete",
          }),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined)),
          ),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildConfigByScriptId", {
            captureStackTrace: true,
          }),
        ),
      upsertGuildConfig: (
        guildId: string,
        config: {
          scriptId?: string | null | undefined;
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
      getGuildManagerRoles: (guildId: string) =>
        pipe(
          ZeroService.run(queries.guildConfig.getGuildManagerRoles({ guildId }), {
            type: "complete",
          }),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfigManagerRole)))),
          catchParseErrorAsValidationError,
          Effect.withSpan("GuildConfigService.getGuildManagerRoles", {
            captureStackTrace: true,
          }),
        ),
      addGuildManagerRole: (guildId: string, roleId: string) =>
        pipe(
          ZeroService.mutate(mutators.guildConfig.addGuildManagerRole({ guildId, roleId })),
          Effect.andThen((mutation) => mutation.server()),
          Effect.andThen(
            ZeroService.run(queries.guildConfig.getGuildManagerRoles({ guildId }), {
              type: "complete",
            }),
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfigManagerRole)))),
          catchParseErrorAsValidationError,
          Effect.map(Array.findFirst((role) => role.roleId === roleId)),
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(makeDBQueryError("Failed to add guild manager role")),
            }),
          ),
          Effect.withSpan("GuildConfigService.addGuildManagerRole", {
            captureStackTrace: true,
          }),
        ),
      removeGuildManagerRole: (guildId: string, roleId: string) =>
        pipe(
          ZeroService.mutate(mutators.guildConfig.removeGuildManagerRole({ guildId, roleId })),
          Effect.andThen((mutation) => mutation.server()),
          Effect.andThen(
            ZeroService.run(queries.guildConfig.getGuildManagerRoles({ guildId }), {
              type: "complete",
            }),
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfigManagerRole)))),
          catchParseErrorAsValidationError,
          Effect.map(Array.findFirst((role) => role.roleId === roleId)),
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(makeDBQueryError("Failed to remove guild manager role")),
            }),
          ),
          Effect.withSpan("GuildConfigService.removeGuildManagerRole", {
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
            ZeroService.run(
              queries.guildConfig.getGuildRunningChannelById({ guildId, channelId }),
              { type: "complete" },
            ),
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
      getGuildRunningChannelById: (params: { guildId: string; channelId: string }) =>
        pipe(
          ZeroService.run(
            queries.guildConfig.getGuildRunningChannelById({
              guildId: params.guildId,
              channelId: params.channelId,
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
          Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
            captureStackTrace: true,
          }),
        ),
      getGuildRunningChannelByName: (params: { guildId: string; channelName: string }) =>
        pipe(
          ZeroService.run(
            queries.guildConfig.getGuildRunningChannelByName({
              guildId: params.guildId,
              channelName: params.channelName,
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
          Effect.withSpan("GuildConfigService.getGuildRunningChannelByName", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [ZeroLive],
  accessors: true,
}) {}
