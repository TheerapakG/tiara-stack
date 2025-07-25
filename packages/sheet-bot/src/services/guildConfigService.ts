import { and, eq, isNull } from "drizzle-orm";
import { Effect, pipe } from "effect";
import {
  configGuild,
  configGuildManagerRole,
  configGuildRunningChannel,
} from "sheet-db-schema";
import { DBSubscriptionContext } from "typhoon-server/db";
import { DB } from "../db";

export class GuildConfigService extends Effect.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DB),
      Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
      Effect.map(({ db, dbSubscriptionContext }) => ({
        getConfig: (guildId: string) =>
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
            Effect.withSpan("GuildConfigService.getConfig", {
              captureStackTrace: true,
            }),
          ),
        updateConfig: (
          guildId: string,
          config: Partial<typeof configGuild.$inferInsert>,
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
                }),
            ),
            Effect.withSpan("GuildConfigService.updateConfig", {
              captureStackTrace: true,
            }),
          ),
        getManagerRoles: (guildId: string) =>
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
            Effect.withSpan("GuildConfigService.getManagerRoles", {
              captureStackTrace: true,
            }),
          ),
        addManagerRole: (guildId: string, roleId: string) =>
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
                }),
            ),
            Effect.withSpan("GuildConfigService.addManagerRole", {
              captureStackTrace: true,
            }),
          ),
        removeManagerRole: (guildId: string, roleId: string) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .update(configGuildManagerRole)
                .set({ deletedAt: new Date() })
                .where(
                  and(
                    eq(configGuildManagerRole.guildId, guildId),
                    eq(configGuildManagerRole.roleId, roleId),
                  ),
                )
                .returning(),
            ),
            Effect.withSpan("GuildConfigService.removeManagerRole", {
              captureStackTrace: true,
            }),
          ),
        addRunningChannel: (guildId: string, channelId: string, name: string) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(configGuildRunningChannel)
                .values({ guildId, channelId, name })
                .onConflictDoUpdate({
                  target: [
                    configGuildRunningChannel.guildId,
                    configGuildRunningChannel.name,
                  ],
                  set: { channelId, deletedAt: null },
                }),
              // TODO: handle channel conflict
            ),
            Effect.withSpan("GuildConfigService.addRunningChannel", {
              captureStackTrace: true,
            }),
          ),
        removeRunningChannel: (guildId: string, name: string) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .update(configGuildRunningChannel)
                .set({ deletedAt: new Date() })
                .where(
                  and(
                    eq(configGuildRunningChannel.guildId, guildId),
                    eq(configGuildRunningChannel.name, name),
                  ),
                )
                .returning(),
            ),
            Effect.withSpan("GuildConfigService.removeRunningChannel", {
              captureStackTrace: true,
            }),
          ),
        getRunningChannel: (guildId: string, name: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuildRunningChannel)
                .where(
                  and(
                    eq(configGuildRunningChannel.guildId, guildId),
                    eq(configGuildRunningChannel.name, name),
                    isNull(configGuildRunningChannel.deletedAt),
                  ),
                ),
            ),
            Effect.withSpan("GuildConfigService.getRunningChannel", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
