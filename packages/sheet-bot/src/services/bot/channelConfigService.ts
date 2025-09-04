import { DB } from "@/db";
import { eq } from "drizzle-orm";
import { Array, Data, Effect, Option, pipe } from "effect";
import { configChannel } from "sheet-db-schema";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Computed } from "typhoon-server/signal";

type ConfigInsert = typeof configChannel.$inferInsert;
type ConfigSelect = typeof configChannel.$inferSelect;

export class Config extends Data.TaggedClass("Config")<{
  id: number;
  channelId: string;
  day: Option.Option<number>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect = (select: ConfigSelect) =>
    new Config({
      id: select.id,
      channelId: select.channelId,
      day: Option.fromNullable(select.day),
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
}

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
            Computed.map(Array.head),
            Computed.map(Option.map(Config.fromDbSelect)),
            Effect.withSpan("ChannelConfigService.getConfig", {
              captureStackTrace: true,
            }),
          ),
        upsertConfig: (
          channelId: string,
          config: Omit<
            ConfigInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "channelId"
          >,
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
            Effect.withSpan("ChannelConfigService.upsertConfig", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
