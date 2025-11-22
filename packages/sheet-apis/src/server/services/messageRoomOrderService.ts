import { DBService } from "@/db";
import {
  MessageRoomOrder,
  MessageRoomOrderRange,
  MessageRoomOrderEntry,
} from "@/server/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Array, DateTime, Effect, Option, pipe, Schema } from "effect";
import { messageRoomOrder, messageRoomOrderEntry } from "sheet-db-schema";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass, Result } from "typhoon-core/schema";
import {
  Computed,
  ExternalComputed,
  ZeroQueryExternalSource,
} from "typhoon-core/signal";
import { DB } from "typhoon-server/db";
import { ZeroServiceTag } from "@/db/zeroService";

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
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.messageRoomOrder
                  .where("messageId", "=", messageId)
                  .where("deletedAt", "IS", null)
                  .one(),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Computed.flatten(),
            Computed.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.Union(
                    DefaultTaggedClass(MessageRoomOrder),
                    Schema.Undefined,
                  ),
                  complete: Schema.Union(
                    DefaultTaggedClass(MessageRoomOrder),
                    Schema.Undefined,
                  ),
                }),
              ),
            ),
            Computed.map(Result.map(Option.fromNullable)),
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
                Schema.OptionFromSelf(DefaultTaggedClass(MessageRoomOrder)),
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
                Schema.OptionFromSelf(DefaultTaggedClass(MessageRoomOrder)),
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
                  set: {
                    deletedAt: null,
                    hour: sql`excluded.hour`,
                    previousFills: sql`excluded.previous_fills`,
                    fills: sql`excluded.fills`,
                    rank: sql`excluded.rank`,
                    monitor: sql`excluded.monitor`,
                  },
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
            Effect.flatMap(Schema.decode(DefaultTaggedClass(MessageRoomOrder))),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderEntry: (messageId: string, rank: number) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.messageRoomOrderEntry
                  .where("messageId", "=", messageId)
                  .where("rank", "=", rank)
                  .where("deletedAt", "IS", null)
                  .orderBy("position", "asc"),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Computed.flatten(),
            Computed.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.Array(
                    DefaultTaggedClass(MessageRoomOrderEntry),
                  ),
                  complete: Schema.Array(
                    DefaultTaggedClass(MessageRoomOrderEntry),
                  ),
                }),
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
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.messageRoomOrderEntry
                  .where("messageId", "=", messageId)
                  .where("deletedAt", "IS", null),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Computed.flatten(),
            Computed.flatMap(
              Schema.decode(
                Result.ResultSchema({
                  optimistic: Schema.Array(
                    DefaultTaggedClass(MessageRoomOrderEntry),
                  ),
                  complete: Schema.Array(
                    DefaultTaggedClass(MessageRoomOrderEntry),
                  ),
                }),
              ),
            ),
            Computed.map(
              Result.map((entries) =>
                pipe(
                  entries,
                  Array.match({
                    onEmpty: () => Option.none<MessageRoomOrderRange>(),
                    onNonEmpty: ([head, ...tail]) => {
                      const { minRank, maxRank } = pipe(
                        tail,
                        Array.reduce(
                          {
                            minRank: head.rank,
                            maxRank: head.rank,
                          },
                          (acc, entry) => ({
                            minRank: Math.min(acc.minRank, entry.rank),
                            maxRank: Math.max(acc.maxRank, entry.rank),
                          }),
                        ),
                      );
                      return Option.some(
                        new MessageRoomOrderRange({ minRank, maxRank }),
                      );
                    },
                  }),
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
                  set: {
                    deletedAt: null,
                    hour: sql`excluded.hour`,
                    team: sql`excluded.team`,
                    tags: sql`excluded.tags`,
                    effectValue: sql`excluded.effect_value`,
                  },
                })
                .returning(),
            ),
            Effect.flatMap(
              Schema.decode(
                Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
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
                Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
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
