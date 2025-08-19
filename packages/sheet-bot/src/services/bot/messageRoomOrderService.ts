import { and, eq, isNull } from "drizzle-orm";
import { Array, Data, Effect, Option, pipe } from "effect";
import { messageRoomOrder } from "sheet-db-schema";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Computed } from "typhoon-server/signal";
import { DB } from "../../db";

type MessageRoomOrderInsert = typeof messageRoomOrder.$inferInsert;
type MessageRoomOrderSelect = typeof messageRoomOrder.$inferSelect;

export class MessageRoomOrder extends Data.TaggedClass("MessageRoomOrder")<{
  id: number;
  messageId: string;
  rank: number;
  position: number;
  team: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect(select: MessageRoomOrderSelect) {
    return new MessageRoomOrder({
      id: select.id,
      messageId: select.messageId,
      rank: select.rank,
      position: select.position,
      team: select.team,
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
        getMessageRoomOrder: (messageId: string, rank: number) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(messageRoomOrder)
                .where(
                  and(
                    eq(messageRoomOrder.messageId, messageId),
                    eq(messageRoomOrder.rank, rank),
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
        addMessageRoomOrder: (
          messageId: string,
          data: Omit<
            MessageRoomOrderInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >[],
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(messageRoomOrder)
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
                    messageRoomOrder.messageId,
                    messageRoomOrder.rank,
                    messageRoomOrder.position,
                    messageRoomOrder.team,
                  ],
                  set: { deletedAt: null },
                }),
            ),
            Effect.withSpan("MessageRoomOrderService.addMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        removeMessageRoomOrder: (messageId: string) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .update(messageRoomOrder)
                .set({ deletedAt: new Date() })
                .where(
                  and(
                    eq(messageRoomOrder.messageId, messageId),
                    isNull(messageRoomOrder.deletedAt),
                  ),
                ),
            ),
            Effect.withSpan("MessageRoomOrderService.removeMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
