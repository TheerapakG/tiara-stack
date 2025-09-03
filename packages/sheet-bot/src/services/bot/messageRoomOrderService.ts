import { DB } from "@/db";
import { and, asc, eq, isNull, max, min, sql } from "drizzle-orm";
import { Array, Data, DateTime, Effect, Option, pipe } from "effect";
import { messageRoomOrder, messageRoomOrderData } from "sheet-db-schema";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Computed } from "typhoon-server/signal";

type MessageRoomOrderInsert = typeof messageRoomOrder.$inferInsert;
type MessageRoomOrderSelect = typeof messageRoomOrder.$inferSelect;
type MessageRoomOrderDataInsert = typeof messageRoomOrderData.$inferInsert;
type MessageRoomOrderDataSelect = typeof messageRoomOrderData.$inferSelect;

export class MessageRoomOrder extends Data.TaggedClass("MessageRoomOrder")<{
  id: number;
  messageId: string;
  hour: number;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect(select: MessageRoomOrderSelect) {
    return new MessageRoomOrder({
      id: select.id,
      messageId: select.messageId,
      hour: select.hour,
      rank: select.rank,
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
  }
}

export class MessageRoomOrderRange extends Data.TaggedClass(
  "MessageRoomOrderRange",
)<{
  minRank: number;
  maxRank: number;
}> {
  static fromDbSelect(select: {
    minRank: number | null;
    maxRank: number | null;
  }) {
    return new MessageRoomOrderRange({
      minRank: select.minRank ?? NaN,
      maxRank: select.maxRank ?? NaN,
    });
  }
}

export class MessageRoomOrderData extends Data.TaggedClass(
  "MessageRoomOrderData",
)<{
  id: number;
  messageId: string;
  rank: number;
  position: number;
  team: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect(select: MessageRoomOrderDataSelect) {
    return new MessageRoomOrderData({
      id: select.id,
      messageId: select.messageId,
      rank: select.rank,
      position: select.position,
      team: select.team,
      tags: select.tags,
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
  }
}

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DB),
      Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
      Effect.map(({ db, dbSubscriptionContext }) => ({
        getMessageRoomOrder: (messageId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(messageRoomOrder)
                .where(
                  and(
                    eq(messageRoomOrder.messageId, messageId),
                    isNull(messageRoomOrder.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.map(Option.map(MessageRoomOrder.fromDbSelect)),
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        decrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .update(messageRoomOrder)
                .set({ rank: sql`${messageRoomOrder.rank} - 1` })
                .where(
                  and(
                    eq(messageRoomOrder.messageId, messageId),
                    isNull(messageRoomOrder.deletedAt),
                  ),
                )
                .returning(),
            ),
            Effect.map(Array.head),
            Effect.map(Option.map(MessageRoomOrder.fromDbSelect)),
            Effect.withSpan(
              "MessageRoomOrderService.decrementMessageRoomOrderRank",
              {
                captureStackTrace: true,
              },
            ),
          ),
        incrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .update(messageRoomOrder)
                .set({ rank: sql`${messageRoomOrder.rank} + 1` })
                .where(
                  and(
                    eq(messageRoomOrder.messageId, messageId),
                    isNull(messageRoomOrder.deletedAt),
                  ),
                )
                .returning(),
            ),
            Effect.map(Array.head),
            Effect.map(Option.map(MessageRoomOrder.fromDbSelect)),
            Effect.withSpan(
              "MessageRoomOrderService.incrementMessageRoomOrderRank",
              {
                captureStackTrace: true,
              },
            ),
          ),
        upsertMessageRoomOrder: (
          messageId: string,
          data: Omit<
            MessageRoomOrderInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >,
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(messageRoomOrder)
                .values({ messageId, ...data })
                .onConflictDoUpdate({
                  target: [messageRoomOrder.messageId],
                  set: { deletedAt: null },
                }),
            ),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderData: (messageId: string, rank: number) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(messageRoomOrderData)
                .where(
                  and(
                    eq(messageRoomOrderData.messageId, messageId),
                    eq(messageRoomOrderData.rank, rank),
                    isNull(messageRoomOrderData.deletedAt),
                  ),
                )
                .orderBy(asc(messageRoomOrderData.position)),
            ),
            Computed.map(Array.map(MessageRoomOrderData.fromDbSelect)),
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderData", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderRange: (messageId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select({
                  minRank: min(messageRoomOrder.rank),
                  maxRank: max(messageRoomOrder.rank),
                })
                .from(messageRoomOrderData)
                .where(
                  and(
                    eq(messageRoomOrderData.messageId, messageId),
                    isNull(messageRoomOrderData.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.map(Option.map(MessageRoomOrderRange.fromDbSelect)),
            Effect.withSpan(
              "MessageRoomOrderService.getMessageRoomOrderRange",
              {
                captureStackTrace: true,
              },
            ),
          ),
        upsertMessageRoomOrderData: (
          messageId: string,
          data: Omit<
            MessageRoomOrderDataInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >[],
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(messageRoomOrderData)
                .values(
                  pipe(
                    data,
                    Array.map((data) => ({
                      messageId,
                      ...data,
                    })),
                  ),
                )
                .onConflictDoUpdate({
                  target: [
                    messageRoomOrderData.messageId,
                    messageRoomOrderData.rank,
                    messageRoomOrderData.position,
                  ],
                  set: { deletedAt: null },
                }),
            ),
            Effect.withSpan(
              "MessageRoomOrderService.upsertMessageRoomOrderData",
              {
                captureStackTrace: true,
              },
            ),
          ),
        removeMessageRoomOrderData: (messageId: string) =>
          pipe(
            DateTime.now,
            Effect.flatMap((now) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .update(messageRoomOrderData)
                  .set({ deletedAt: DateTime.toDate(now) })
                  .where(
                    and(
                      eq(messageRoomOrderData.messageId, messageId),
                      isNull(messageRoomOrderData.deletedAt),
                    ),
                  ),
              ),
            ),
            Effect.withSpan(
              "MessageRoomOrderService.removeMessageRoomOrderData",
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
