import { and, eq, isNull } from "drizzle-orm";
import { Effect, pipe } from "effect";
import { configGuild, configGuildManagerRole } from "sheet-db-schema";
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
              ),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
