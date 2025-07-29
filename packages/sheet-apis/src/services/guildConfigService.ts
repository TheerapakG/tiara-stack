import { and, eq, isNull } from "drizzle-orm";
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
        getGuildConfigWithBoundScript: (scriptId: string) =>
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
            Effect.withSpan(
              "GuildConfigService.getGuildConfigWithBoundScript",
              {
                captureStackTrace: true,
              },
            ),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
