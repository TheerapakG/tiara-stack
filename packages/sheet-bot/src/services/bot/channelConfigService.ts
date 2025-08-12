import { eq } from "drizzle-orm";
import { Effect, pipe } from "effect";
import { configChannel } from "sheet-db-schema";
import { DBSubscriptionContext } from "typhoon-server/db";
import { DB } from "../../db";

export class ChannelConfigService extends Effect.Service<ChannelConfigService>()(
  "ChannelConfigService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DB),
      Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
      Effect.map(({ db, dbSubscriptionContext }) => ({
        getConfig: (channelId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(configChannel)
                .where(eq(configChannel.channelId, channelId)),
            ),
            Effect.withSpan("ChannelConfigService.getConfig", {
              captureStackTrace: true,
            }),
          ),
        updateConfig: (
          channelId: string,
          config: Partial<typeof configChannel.$inferInsert>,
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(configChannel)
                .values({
                  channelId,
                  ...config,
                })
                .onConflictDoUpdate({
                  target: [configChannel.channelId],
                  set: {
                    ...config,
                  },
                }),
            ),
            Effect.withSpan("ChannelConfigService.updateConfig", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
