import { DBService } from "@/db";
import {
  GuildChannelConfig,
  GuildConfig,
  GuildConfigManagerRole,
  ZeroGuildChannelConfig,
} from "@/server/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Array, DateTime, Effect, Option, pipe, Schema } from "effect";
import {
  configGuild,
  configGuildChannel,
  configGuildManagerRole,
} from "sheet-db-schema";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass, Result } from "typhoon-core/schema";
import {
  Computed,
  ZeroQueryExternalSource,
  ExternalComputed,
} from "typhoon-core/signal";
import { DB } from "typhoon-server/db";
import { ZeroServiceTag } from "@/db/zeroService";

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
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuild)
                .where(
                  and(
                    eq(configGuild.autoCheckin, true),
                    isNull(configGuild.deletedAt),
                  ),
                ),
            ),
            Computed.flatMap(
              Schema.decode(Schema.Array(DefaultTaggedClass(GuildConfig))),
            ),
            Effect.withSpan("GuildConfigService.getAutoCheckinGuilds", {
              captureStackTrace: true,
            }),
          ),
        getGuildConfigByGuildId: (guildId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuild)
                .where(
                  and(
                    eq(configGuild.guildId, guildId),
                    isNull(configGuild.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(DefaultTaggedClass(GuildConfig)),
              ),
            ),
            Effect.withSpan("GuildConfigService.getConfig", {
              captureStackTrace: true,
            }),
          ),
        getGuildConfigByScriptId: (scriptId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuild)
                .where(
                  and(
                    eq(configGuild.scriptId, scriptId),
                    isNull(configGuild.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(DefaultTaggedClass(GuildConfig)),
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildConfigByScriptId", {
              captureStackTrace: true,
            }),
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
        getGuildManagerRoles: (guildId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuildManagerRole)
                .where(
                  and(
                    eq(configGuildManagerRole.guildId, guildId),
                    isNull(configGuildManagerRole.deletedAt),
                  ),
                ),
            ),
            Computed.flatMap(
              Schema.decode(
                Schema.Array(DefaultTaggedClass(GuildConfigManagerRole)),
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildManagerRoles", {
              captureStackTrace: true,
            }),
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
        getGuildRunningChannelById: (guildId: string, channelId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuildChannel)
                .where(
                  and(
                    eq(configGuildChannel.guildId, guildId),
                    eq(configGuildChannel.channelId, channelId),
                    isNull(configGuildChannel.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(DefaultTaggedClass(GuildChannelConfig)),
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
              captureStackTrace: true,
            }),
          ),
        getZeroGuildRunningChannelById: (guildId: string, channelId: string) =>
          pipe(
            ZeroServiceTag,
            Effect.tap(() => Effect.log(guildId, channelId)),
            Effect.tap((zero) =>
              zero.query.configGuildChannel
                .where("guildId", "=", guildId)
                .where("channelId", "=", channelId)
                .where("deletedAt", "IS", null)
                .one()
                .materialize()
                .addListener((v) => Effect.runSync(Effect.log(v))),
            ),
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.configGuildChannel
                  .where("guildId", "=", guildId)
                  .where("channelId", "=", channelId)
                  .where("deletedAt", "IS", null)
                  .one(),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Computed.flatten(),
            Computed.map(Result.map(Option.fromNullable)),
            Computed.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.OptionFromSelf(
                    DefaultTaggedClass(ZeroGuildChannelConfig),
                  ),
                  complete: Schema.OptionFromSelf(
                    DefaultTaggedClass(ZeroGuildChannelConfig),
                  ),
                }),
              ),
            ),
            Effect.withSpan(
              "GuildConfigService.getZeroGuildRunningChannelById",
              {
                captureStackTrace: true,
              },
            ),
          ),
        getGuildRunningChannelByName: (guildId: string, channelName: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuildChannel)
                .where(
                  and(
                    eq(configGuildChannel.guildId, guildId),
                    eq(configGuildChannel.name, channelName),
                    isNull(configGuildChannel.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(DefaultTaggedClass(GuildChannelConfig)),
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildRunningChannelByName", {
              captureStackTrace: true,
            }),
          ),
        getZeroGuildRunningChannelByName: (
          guildId: string,
          channelName: string,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.configGuildChannel
                  .where("guildId", "=", guildId)
                  .where("name", "=", channelName)
                  .where("deletedAt", "IS", null)
                  .one(),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Computed.flatten(),
            Computed.map(Result.map(Option.fromNullable)),
            Computed.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.OptionFromSelf(
                    DefaultTaggedClass(ZeroGuildChannelConfig),
                  ),
                  complete: Schema.OptionFromSelf(
                    DefaultTaggedClass(ZeroGuildChannelConfig),
                  ),
                }),
              ),
            ),
            Effect.withSpan(
              "GuildConfigService.getZeroGuildRunningChannelByName",
              {
                captureStackTrace: true,
              },
            ),
          ),
      })),
    ),
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
