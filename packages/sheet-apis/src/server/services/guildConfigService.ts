import { DBService } from "@/db";
import { Error, GuildChannelConfig, GuildConfig, GuildConfigManagerRole } from "@/server/schema";
import { and, eq } from "drizzle-orm";
import { Array, DateTime, Effect, pipe, Schema } from "effect";
import { configGuild, configGuildChannel, configGuildManagerRole } from "sheet-db-schema";
import { queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass, Result } from "typhoon-core/schema";
import { ZeroQueryExternalSource, ExternalComputed } from "typhoon-core/signal";
import { DB } from "typhoon-server/db";
import { SignalService } from "typhoon-core/signal";

type GuildConfigInsert = typeof configGuild.$inferInsert;
type GuildChannelConfigInsert = typeof configGuildChannel.$inferInsert;

export class GuildConfigService extends Effect.Service<GuildConfigService>()("GuildConfigService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("db", () => DBService),
    Effect.bind("dbSubscriptionContext", () => DB.DBSubscriptionContext),
    Effect.map(({ db, dbSubscriptionContext }) => ({
      getAutoCheckinGuilds: () =>
        pipe(
          ZeroQueryExternalSource.make(queries.guildConfig.getAutoCheckinGuilds({})),
          Effect.flatMap(ExternalComputed.make),
          Effect.map(
            Effect.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.EitherFromSelf({
                    right: Schema.Array(DefaultTaggedClass(GuildConfig)),
                    left: Error.Core.ZeroQueryError,
                  }),
                  complete: Schema.EitherFromSelf({
                    right: Schema.Array(DefaultTaggedClass(GuildConfig)),
                    left: Error.Core.ZeroQueryError,
                  }),
                }),
              ),
            ),
          ),
          Effect.map(
            Effect.withSpan("GuildConfigService.getAutoCheckinGuilds", {
              captureStackTrace: true,
            }),
          ),
        ),
      _getGuildConfigByGuildId: <E = never>(guildId: SignalService.MaybeSignalEffect<string, E>) =>
        pipe(
          ZeroQueryExternalSource.make(
            pipe(
              guildId,
              SignalService.getMaybeSignalEffectValue,
              Effect.map((guildId) => queries.guildConfig.getGuildConfigByGuildId({ guildId })),
            ),
          ),
          Effect.flatMap(ExternalComputed.make),
          Effect.map(
            Effect.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined),
                    left: Error.Core.ZeroQueryError,
                  }),
                  complete: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined),
                    left: Error.Core.ZeroQueryError,
                  }),
                }),
              ),
            ),
          ),
          Effect.map(
            Effect.withSpan("GuildConfigService.getGuildConfigByGuildId", {
              captureStackTrace: true,
            }),
          ),
        ),
      _getGuildConfigByScriptId: <E = never>(
        scriptId: SignalService.MaybeSignalEffect<string, E>,
      ) =>
        pipe(
          ZeroQueryExternalSource.make(
            pipe(
              scriptId,
              SignalService.getMaybeSignalEffectValue,
              Effect.map((scriptId) => queries.guildConfig.getGuildConfigByScriptId({ scriptId })),
            ),
          ),
          Effect.flatMap(ExternalComputed.make),
          Effect.map(
            Effect.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined),
                    left: Error.Core.ZeroQueryError,
                  }),
                  complete: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(DefaultTaggedClass(GuildConfig), undefined),
                    left: Error.Core.ZeroQueryError,
                  }),
                }),
              ),
            ),
          ),
          Effect.map(
            Effect.withSpan("GuildConfigService.getGuildConfigByScriptId", {
              captureStackTrace: true,
            }),
          ),
        ),
      upsertGuildConfig: (
        guildId: string,
        config: Omit<
          Partial<GuildConfigInsert>,
          "id" | "createdAt" | "updatedAt" | "deletedAt" | "guildId"
        >,
      ) =>
        pipe(
          dbSubscriptionContext.mutateQuery(
            db
              .insert(configGuild)
              .values({
                guildId,
                autoCheckin: false,
                ...config,
              })
              .onConflictDoUpdate({
                target: [configGuild.guildId],
                set: {
                  ...config,
                },
              })
              .returning(),
          ),
          Effect.flatMap(
            Array.match({
              onNonEmpty: Effect.succeed,
              onEmpty: () => Effect.die(makeDBQueryError("Failed to upsert guild config")),
            }),
          ),
          Effect.map(Array.headNonEmpty),
          Effect.flatMap(Schema.decode(DefaultTaggedClass(GuildConfig))),
          Effect.withSpan("GuildConfigService.upsertGuildConfig", {
            captureStackTrace: true,
          }),
        ),
      _getGuildManagerRoles: <E = never>(guildId: SignalService.MaybeSignalEffect<string, E>) =>
        pipe(
          ZeroQueryExternalSource.make(
            pipe(
              guildId,
              SignalService.getMaybeSignalEffectValue,
              Effect.map((guildId) => queries.guildConfig.getGuildManagerRoles({ guildId })),
            ),
          ),
          Effect.flatMap(ExternalComputed.make),
          Effect.map(
            Effect.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.EitherFromSelf({
                    right: Schema.Array(DefaultTaggedClass(GuildConfigManagerRole)),
                    left: Error.Core.ZeroQueryError,
                  }),
                  complete: Schema.EitherFromSelf({
                    right: Schema.Array(DefaultTaggedClass(GuildConfigManagerRole)),
                    left: Error.Core.ZeroQueryError,
                  }),
                }),
              ),
            ),
          ),
          Effect.map(
            Effect.withSpan("GuildConfigService.getGuildManagerRoles", {
              captureStackTrace: true,
            }),
          ),
        ),
      addGuildManagerRole: (guildId: string, roleId: string) =>
        pipe(
          dbSubscriptionContext.mutateQuery(
            db
              .insert(configGuildManagerRole)
              .values({ guildId, roleId })
              .onConflictDoUpdate({
                target: [configGuildManagerRole.guildId, configGuildManagerRole.roleId],
                set: { deletedAt: null },
              })
              .returning(),
          ),
          Effect.flatMap(
            Array.match({
              onNonEmpty: Effect.succeed,
              onEmpty: () => Effect.die(makeDBQueryError("Failed to add guild manager role")),
            }),
          ),
          Effect.map(Array.headNonEmpty),
          Effect.flatMap(Schema.decode(DefaultTaggedClass(GuildConfigManagerRole))),
          Effect.withSpan("GuildConfigService.addGuildManagerRole", {
            captureStackTrace: true,
          }),
        ),
      removeGuildManagerRole: (guildId: string, roleId: string) =>
        pipe(
          Effect.Do,
          Effect.bind("now", () => DateTime.now),
          Effect.flatMap(({ now }) =>
            dbSubscriptionContext.mutateQuery(
              db
                .update(configGuildManagerRole)
                .set({ deletedAt: DateTime.toDate(now) })
                .where(
                  and(
                    eq(configGuildManagerRole.guildId, guildId),
                    eq(configGuildManagerRole.roleId, roleId),
                  ),
                )
                .returning(),
            ),
          ),
          Effect.map(Array.head),
          Effect.flatMap(
            Schema.decode(Schema.OptionFromSelf(DefaultTaggedClass(GuildConfigManagerRole))),
          ),
          Effect.withSpan("GuildConfigService.removeGuildManagerRole", {
            captureStackTrace: true,
          }),
        ),
      upsertGuildChannelConfig: (
        guildId: string,
        channelId: string,
        config: Omit<
          Partial<GuildChannelConfigInsert>,
          "id" | "createdAt" | "updatedAt" | "deletedAt" | "guildId" | "channelId"
        >,
      ) =>
        pipe(
          dbSubscriptionContext.mutateQuery(
            db
              .insert(configGuildChannel)
              .values([{ guildId, channelId, running: false, ...config }])
              .onConflictDoUpdate({
                target: [configGuildChannel.guildId, configGuildChannel.channelId],
                set: { ...config, deletedAt: null },
              })
              .returning(),
            // TODO: handle channel conflict
          ),
          Effect.flatMap(
            Array.match({
              onNonEmpty: Effect.succeed,
              onEmpty: () => Effect.die(makeDBQueryError("Failed to upsert guild channel config")),
            }),
          ),
          Effect.map(Array.headNonEmpty),
          Effect.flatMap(Schema.decode(DefaultTaggedClass(GuildChannelConfig))),
          Effect.withSpan("GuildConfigService.upsertGuildChannelConfig", {
            captureStackTrace: true,
          }),
        ),
      _getGuildRunningChannelById: <E = never>(
        params: SignalService.MaybeSignalEffect<{ guildId: string; channelId: string }, E>,
      ) =>
        pipe(
          ZeroQueryExternalSource.make(
            pipe(
              params,
              SignalService.getMaybeSignalEffectValue,
              Effect.map(({ guildId, channelId }) =>
                queries.guildConfig.getGuildRunningChannelById({ guildId, channelId }),
              ),
            ),
          ),
          Effect.flatMap(ExternalComputed.make),
          Effect.map(
            Effect.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(
                      DefaultTaggedClass(GuildChannelConfig),
                      undefined,
                    ),
                    left: Error.Core.ZeroQueryError,
                  }),
                  complete: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(
                      DefaultTaggedClass(GuildChannelConfig),
                      undefined,
                    ),
                    left: Error.Core.ZeroQueryError,
                  }),
                }),
              ),
            ),
          ),
          Effect.map(
            Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
              captureStackTrace: true,
            }),
          ),
        ),
      _getGuildRunningChannelByName: <E = never>(
        params: SignalService.MaybeSignalEffect<{ guildId: string; channelName: string }, E>,
      ) =>
        pipe(
          ZeroQueryExternalSource.make(
            pipe(
              params,
              SignalService.getMaybeSignalEffectValue,
              Effect.map(({ guildId, channelName }) =>
                queries.guildConfig.getGuildRunningChannelByName({ guildId, channelName }),
              ),
            ),
          ),
          Effect.flatMap(ExternalComputed.make),
          Effect.map(
            Effect.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(
                      DefaultTaggedClass(GuildChannelConfig),
                      undefined,
                    ),
                    left: Error.Core.ZeroQueryError,
                  }),
                  complete: Schema.EitherFromSelf({
                    right: Schema.OptionFromNullishOr(
                      DefaultTaggedClass(GuildChannelConfig),
                      undefined,
                    ),
                    left: Error.Core.ZeroQueryError,
                  }),
                }),
              ),
            ),
          ),
          Effect.map(
            Effect.withSpan("GuildConfigService.getGuildRunningChannelByName", {
              captureStackTrace: true,
            }),
          ),
        ),
    })),
  ),
  dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
  accessors: true,
}) {
  static getGuildConfigByGuildId = <E = never>(
    guildId: SignalService.MaybeSignalEffect<string, E>,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildConfigByGuildId(guildId),
    );

  static getGuildConfigByScriptId = <E = never>(
    scriptId: SignalService.MaybeSignalEffect<string, E>,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildConfigByScriptId(scriptId),
    );

  static getGuildManagerRoles = <E = never>(guildId: SignalService.MaybeSignalEffect<string, E>) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildManagerRoles(guildId),
    );

  static getGuildRunningChannelById = <E = never>(
    params: SignalService.MaybeSignalEffect<{ guildId: string; channelId: string }, E>,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildRunningChannelById(params),
    );

  static getGuildRunningChannelByName = <E = never>(
    params: SignalService.MaybeSignalEffect<{ guildId: string; channelName: string }, E>,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildRunningChannelByName(params),
    );
}
