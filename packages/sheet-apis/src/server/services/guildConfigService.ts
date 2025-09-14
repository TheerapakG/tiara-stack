import { DB } from "@/db";
import {
  GuildChannelConfig,
  GuildConfig,
  GuildConfigManagerRole,
} from "@/server/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Array, DateTime, Effect, Option, pipe, Schema } from "effect";
import {
  configGuild,
  configGuildChannel,
  configGuildManagerRole,
} from "sheet-db-schema";
import { Computed } from "typhoon-core/signal";
import { DBSubscriptionContext } from "typhoon-server/db";

type GuildConfigInsert = typeof configGuild.$inferInsert;
type GuildChannelConfigInsert = typeof configGuildChannel.$inferInsert;

export class GuildConfigService extends Effect.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DB),
      Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
      Effect.map(({ db, dbSubscriptionContext }) => ({
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
            Computed.map(
              Option.map((v) =>
                Schema.decodeEither(GuildConfig)({
                  _tag: GuildConfig._tag,
                  ...v,
                }),
              ),
            ),
            Computed.flatMap(Effect.transposeOption),
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
            Computed.map(
              Option.map((v) =>
                Schema.decodeEither(GuildConfig)({
                  _tag: GuildConfig._tag,
                  ...v,
                }),
              ),
            ),
            Computed.flatMap(Effect.transposeOption),
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
            Effect.map(Array.head),
            Effect.map(
              Option.map((v) =>
                Schema.decodeEither(GuildConfig)({
                  _tag: GuildConfig._tag,
                  ...v,
                }),
              ),
            ),
            Effect.flatMap(Effect.transposeOption),
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
              Effect.forEach((v) =>
                Schema.decodeEither(GuildConfigManagerRole)({
                  _tag: GuildConfigManagerRole._tag,
                  ...v,
                }),
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
            Effect.map(Array.head),
            Effect.map(
              Option.map((v) =>
                Schema.decodeEither(GuildConfigManagerRole)({
                  _tag: GuildConfigManagerRole._tag,
                  ...v,
                }),
              ),
            ),
            Effect.flatMap(Effect.transposeOption),
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
            Effect.flatMap(
              Effect.forEach((v) =>
                Schema.decodeEither(GuildConfigManagerRole)({
                  _tag: GuildConfigManagerRole._tag,
                  ...v,
                }),
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
                .values({ guildId, channelId, ...config })
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
            Effect.map(Array.head),
            Effect.map(
              Option.map((v) =>
                Schema.decodeEither(GuildChannelConfig)({
                  _tag: GuildChannelConfig._tag,
                  ...v,
                }),
              ),
            ),
            Effect.flatMap(Effect.transposeOption),
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
            Computed.map(
              Option.map((v) =>
                Schema.decodeEither(GuildChannelConfig)({
                  _tag: GuildChannelConfig._tag,
                  ...v,
                }),
              ),
            ),
            Computed.flatMap(Effect.transposeOption),
            Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
              captureStackTrace: true,
            }),
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
            Computed.map(
              Option.map((v) =>
                Schema.decodeEither(GuildChannelConfig)({
                  _tag: GuildChannelConfig._tag,
                  ...v,
                }),
              ),
            ),
            Computed.flatMap(Effect.transposeOption),
            Effect.withSpan("GuildConfigService.getGuildRunningChannelByName", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
