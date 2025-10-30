import { DBService } from "@/db";
import {
  MessageRoomOrder,
  MessageRoomOrderRange,
  MessageRoomOrderEntry,
} from "@/server/schema";
import { and, asc, eq, isNull, max, min, sql } from "drizzle-orm";
import { Array, DateTime, Effect, Option, pipe, Schema } from "effect";
import { messageRoomOrder, messageRoomOrderEntry } from "sheet-db-schema";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { Computed } from "typhoon-core/signal";
import { DB } from "typhoon-server/db";

type MessageRoomOrderInsert = typeof messageRoomOrder.$inferInsert;
type MessageRoomOrderEntryInsert = typeof messageRoomOrderEntry.$inferInsert;

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DBService),
      Effect.bind("dbSubscriptionContext", () => DB.DBSubscriptionContext),
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
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrder),
                ),
              ),
            ),
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
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrder),
                ),
              ),
            ),
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
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrder),
                ),
              ),
            ),
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
                })
                .returning(),
            ),
            Effect.flatMap(
              Array.match({
                onNonEmpty: Effect.succeed,
                onEmpty: () =>
                  Effect.die(
                    makeDBQueryError("Failed to upsert message room order"),
                  ),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(
              Schema.decode(
                DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrder),
              ),
            ),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderEntry: (messageId: string, rank: number) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(messageRoomOrderEntry)
                .where(
                  and(
                    eq(messageRoomOrderEntry.messageId, messageId),
                    eq(messageRoomOrderEntry.rank, rank),
                    isNull(messageRoomOrderEntry.deletedAt),
                  ),
                )
                .orderBy(asc(messageRoomOrderEntry.position)),
            ),
            Computed.flatMap(
              Schema.decode(
                Schema.Array(
                  DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrderEntry),
                ),
              ),
            ),
            Effect.withSpan(
              "MessageRoomOrderService.getMessageRoomOrderEntry",
              {
                captureStackTrace: true,
              },
            ),
          ),
        getMessageRoomOrderRange: (messageId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select({
                  minRank: min(messageRoomOrder.rank),
                  maxRank: max(messageRoomOrder.rank),
                })
                .from(messageRoomOrderEntry)
                .where(
                  and(
                    eq(messageRoomOrderEntry.messageId, messageId),
                    isNull(messageRoomOrderEntry.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.map(
              Option.flatMap(({ minRank, maxRank }) =>
                pipe(
                  Option.Do,
                  Option.bind("minRank", () => Option.fromNullable(minRank)),
                  Option.bind("maxRank", () => Option.fromNullable(maxRank)),
                ),
              ),
            ),
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrderRange),
                ),
              ),
            ),
            Effect.withSpan(
              "MessageRoomOrderService.getMessageRoomOrderRange",
              {
                captureStackTrace: true,
              },
            ),
          ),
        upsertMessageRoomOrderEntry: (
          messageId: string,
          entries: Omit<
            MessageRoomOrderEntryInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >[],
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(messageRoomOrderEntry)
                .values(
                  pipe(
                    entries,
                    Array.map((entry) => ({
                      messageId,
                      ...entry,
                    })),
                  ),
                )
                .onConflictDoUpdate({
                  target: [
                    messageRoomOrderEntry.messageId,
                    messageRoomOrderEntry.rank,
                    messageRoomOrderEntry.position,
                  ],
                  set: { deletedAt: null },
                })
                .returning(),
            ),
            Effect.flatMap(
              Schema.decode(
                Schema.Array(
                  DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrderEntry),
                ),
              ),
            ),
            Effect.withSpan(
              "MessageRoomOrderService.upsertMessageRoomOrderEntry",
              {
                captureStackTrace: true,
              },
            ),
          ),
        removeMessageRoomOrderEntry: (messageId: string) =>
          pipe(
            DateTime.now,
            Effect.flatMap((now) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .update(messageRoomOrderEntry)
                  .set({ deletedAt: DateTime.toDate(now) })
                  .where(
                    and(
                      eq(messageRoomOrderEntry.messageId, messageId),
                      isNull(messageRoomOrderEntry.deletedAt),
                    ),
                  )
                  .returning(),
              ),
            ),
            Effect.flatMap(
              Schema.decode(
                Schema.Array(
                  DefaultTaggedClass.DefaultTaggedClass(MessageRoomOrderEntry),
                ),
              ),
            ),
            Effect.withSpan(
              "MessageRoomOrderService.removeMessageRoomOrderEntry",
              {
                captureStackTrace: true,
              },
            ),
          ),
      })),
    ),
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
