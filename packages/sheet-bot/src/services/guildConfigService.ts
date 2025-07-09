import { eq } from "drizzle-orm";
import { Effect, pipe } from "effect";
import { configGuild } from "sheet-db-schema";
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
              .where(eq(configGuild.guildId, guildId)),
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
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
