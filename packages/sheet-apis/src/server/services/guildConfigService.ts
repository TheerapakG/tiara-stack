import { DBService } from "@/db";
import {
  Error,
  GuildChannelConfig,
  GuildConfig,
  GuildConfigManagerRole,
} from "@/server/schema";
import { and, eq } from "drizzle-orm";
import { Array, DateTime, Effect, pipe, Schema } from "effect";
import {
  configGuild,
  configGuildChannel,
  configGuildManagerRole,
} from "sheet-db-schema";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass, Result } from "typhoon-core/schema";
import { ZeroQueryExternalSource, ExternalComputed } from "typhoon-core/signal";
import { DB } from "typhoon-server/db";
import { ZeroServiceTag } from "@/db/zeroService";
import { SignalContext } from "typhoon-core/signal";

type GuildConfigInsert = typeof configGuild.$inferInsert;
type GuildChannelConfigInsert = typeof configGuildChannel.$inferInsert;

export class GuildConfigService extends Effect.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DBService),
      Effect.bind("dbSubscriptionContext", () => DB.DBSubscriptionContext),
      Effect.map(({ db, dbSubscriptionContext }) => ({
        getAutoCheckinGuilds: () =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.configGuild
                  .where("autoCheckin", "=", true)
                  .where("deletedAt", "IS", null),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.Either({
                      right: Schema.Array(DefaultTaggedClass(GuildConfig)),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.Either({
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
        _getGuildConfigByGuildId: <E = never>(
          guildId: SignalContext.MaybeSignalEffect<string, E>,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                pipe(
                  guildId,
                  SignalContext.getMaybeSignalEffectValue,
                  Effect.map((guildId) =>
                    zero.query.configGuild
                      .where("guildId", "=", guildId)
                      .where("deletedAt", "IS", null)
                      .one(),
                  ),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.Either({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(GuildConfig),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.Either({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(GuildConfig),
                        undefined,
                      ),
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
          scriptId: SignalContext.MaybeSignalEffect<string, E>,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                pipe(
                  scriptId,
                  SignalContext.getMaybeSignalEffectValue,
                  Effect.map((scriptId) =>
                    zero.query.configGuild
                      .where("scriptId", "=", scriptId)
                      .where("deletedAt", "IS", null)
                      .one(),
                  ),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.Either({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(GuildConfig),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.Either({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(GuildConfig),
                        undefined,
                      ),
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
                onEmpty: () =>
                  Effect.die(makeDBQueryError("Failed to upsert guild config")),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(Schema.decode(DefaultTaggedClass(GuildConfig))),
            Effect.withSpan("GuildConfigService.upsertGuildConfig", {
              captureStackTrace: true,
            }),
          ),
        _getGuildManagerRoles: <E = never>(
          guildId: SignalContext.MaybeSignalEffect<string, E>,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                pipe(
                  guildId,
                  SignalContext.getMaybeSignalEffectValue,
                  Effect.map((guildId) =>
                    zero.query.configGuildManagerRole
                      .where("guildId", "=", guildId)
                      .where("deletedAt", "IS", null),
                  ),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.Either({
                      right: Schema.Array(
                        DefaultTaggedClass(GuildConfigManagerRole),
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.Either({
                      right: Schema.Array(
                        DefaultTaggedClass(GuildConfigManagerRole),
                      ),
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
                  target: [
                    configGuildManagerRole.guildId,
                    configGuildManagerRole.roleId,
                  ],
                  set: { deletedAt: null },
                })
                .returning(),
            ),
            Effect.flatMap(
              Array.match({
                onNonEmpty: Effect.succeed,
                onEmpty: () =>
                  Effect.die(
                    makeDBQueryError("Failed to add guild manager role"),
                  ),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(
              Schema.decode(DefaultTaggedClass(GuildConfigManagerRole)),
            ),
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
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass(GuildConfigManagerRole),
                ),
              ),
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
            | "id"
            | "createdAt"
            | "updatedAt"
            | "deletedAt"
            | "guildId"
            | "channelId"
          >,
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(configGuildChannel)
                .values([{ guildId, channelId, running: false, ...config }])
                .onConflictDoUpdate({
                  target: [
                    configGuildChannel.guildId,
                    configGuildChannel.channelId,
                  ],
                  set: { ...config, deletedAt: null },
                })
                .returning(),
              // TODO: handle channel conflict
            ),
            Effect.flatMap(
              Array.match({
                onNonEmpty: Effect.succeed,
                onEmpty: () =>
                  Effect.die(
                    makeDBQueryError("Failed to upsert guild channel config"),
                  ),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(
              Schema.decode(DefaultTaggedClass(GuildChannelConfig)),
            ),
            Effect.withSpan("GuildConfigService.upsertGuildChannelConfig", {
              captureStackTrace: true,
            }),
          ),
        _getGuildRunningChannelById: <E = never>(
          params: SignalContext.MaybeSignalEffect<
            { guildId: string; channelId: string },
            E
          >,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                pipe(
                  params,
                  SignalContext.getMaybeSignalEffectValue,
                  Effect.map(({ guildId, channelId }) =>
                    zero.query.configGuildChannel
                      .where("guildId", "=", guildId)
                      .where("channelId", "=", channelId)
                      .where("deletedAt", "IS", null)
                      .one(),
                  ),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.Either({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(GuildChannelConfig),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.Either({
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
          params: SignalContext.MaybeSignalEffect<
            { guildId: string; channelName: string },
            E
          >,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                pipe(
                  params,
                  SignalContext.getMaybeSignalEffectValue,
                  Effect.map(({ guildId, channelName }) =>
                    zero.query.configGuildChannel
                      .where("guildId", "=", guildId)
                      .where("name", "=", channelName)
                      .where("deletedAt", "IS", null)
                      .one(),
                  ),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.Either({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(GuildChannelConfig),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.Either({
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
              Effect.withSpan(
                "GuildConfigService.getGuildRunningChannelByName",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          ),
      })),
    ),
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {
  static getGuildConfigByGuildId = <E = never>(
    guildId: SignalContext.MaybeSignalEffect<string, E>,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildConfigByGuildId(guildId),
    );

  static getGuildConfigByScriptId = <E = never>(
    scriptId: SignalContext.MaybeSignalEffect<string, E>,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildConfigByScriptId(scriptId),
    );

  static getGuildManagerRoles = <E = never>(
    guildId: SignalContext.MaybeSignalEffect<string, E>,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildManagerRoles(guildId),
    );

  static getGuildRunningChannelById = <E = never>(
    params: SignalContext.MaybeSignalEffect<
      { guildId: string; channelId: string },
      E
    >,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildRunningChannelById(params),
    );

  static getGuildRunningChannelByName = <E = never>(
    params: SignalContext.MaybeSignalEffect<
      { guildId: string; channelName: string },
      E
    >,
  ) =>
    GuildConfigService.use((guildConfigService) =>
      guildConfigService._getGuildRunningChannelByName(params),
    );
}
