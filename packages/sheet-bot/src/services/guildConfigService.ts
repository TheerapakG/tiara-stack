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
        updateConfig: (
          guildId: string,
          config: Partial<typeof configGuild.$inferInsert>,
        ) =>
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
        getManagerRoles: (guildId: string) =>
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
        addManagerRole: (guildId: string, roleId: string) =>
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
        removeManagerRole: (guildId: string, roleId: string) =>
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
        addRunningChannel: (guildId: string, channelId: string, name: string) =>
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
        removeRunningChannel: (guildId: string, name: string) =>
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
        getRunningChannel: (guildId: string, name: string) =>
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
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
