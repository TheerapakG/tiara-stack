import { and, eq, isNull } from "drizzle-orm";
import { Array, Effect, pipe } from "effect";
import {
  configGuild,
  configGuildChannel,
  configGuildManagerRole,
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
        setChannelConfig: (
          guildId: string,
          channelId: string,
          config: Pick<
            typeof configGuildChannel.$inferInsert,
            "running" | "name" | "roleId"
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
            Effect.flatMap(Array.head),
            Effect.withSpan("GuildConfigService.setChannelConfig", {
              captureStackTrace: true,
            }),
          ),
        getRunningChannelById: (guildId: string, id: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuildChannel)
                .where(
                  and(
                    eq(configGuildChannel.guildId, guildId),
                    eq(configGuildChannel.channelId, id),
                    isNull(configGuildChannel.deletedAt),
                  ),
                ),
            ),
            Effect.withSpan("GuildConfigService.getRunningChannelById", {
              captureStackTrace: true,
            }),
          ),
        getRunningChannelByName: (guildId: string, name: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configGuildChannel)
                .where(
                  and(
                    eq(configGuildChannel.guildId, guildId),
                    eq(configGuildChannel.name, name),
                    isNull(configGuildChannel.deletedAt),
                  ),
                ),
            ),
            Effect.withSpan("GuildConfigService.getRunningChannelByName", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
