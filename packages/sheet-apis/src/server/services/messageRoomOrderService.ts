import { DBService } from "@/db";
import {
  Error,
  MessageRoomOrder,
  MessageRoomOrderRange,
  MessageRoomOrderEntry,
} from "@/server/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Array, DateTime, Effect, Either, Option, pipe, Schema } from "effect";
import { messageRoomOrder, messageRoomOrderEntry } from "sheet-db-schema";
import { queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass, Result } from "typhoon-core/schema";
import { ExternalComputed, SignalContext, ZeroQueryExternalSource } from "typhoon-core/signal";
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
        _getMessageRoomOrder: <E = never>(messageId: SignalContext.MaybeSignalEffect<string, E>) =>
          pipe(
            ZeroQueryExternalSource.make(
              pipe(
                messageId,
                SignalContext.getMaybeSignalEffectValue,
                Effect.map((messageId) =>
                  queries.messageRoomOrder.getMessageRoomOrder({ messageId }),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.EitherFromSelf({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(MessageRoomOrder),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.EitherFromSelf({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(MessageRoomOrder),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                  }),
                ),
              ),
            ),
            Effect.map(
              Effect.withSpan("MessageRoomOrderService.getMessageRoomOrder", {
                captureStackTrace: true,
              }),
            ),
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
              Schema.decode(Schema.OptionFromSelf(DefaultTaggedClass(MessageRoomOrder))),
            ),
            Effect.withSpan("MessageRoomOrderService.decrementMessageRoomOrderRank", {
              captureStackTrace: true,
            }),
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
              Schema.decode(Schema.OptionFromSelf(DefaultTaggedClass(MessageRoomOrder))),
            ),
            Effect.withSpan("MessageRoomOrderService.incrementMessageRoomOrderRank", {
              captureStackTrace: true,
            }),
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
                onEmpty: () => Effect.die(makeDBQueryError("Failed to upsert message room order")),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(Schema.decode(DefaultTaggedClass(MessageRoomOrder))),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        _getMessageRoomOrderEntry: <E = never>(
          params: SignalContext.MaybeSignalEffect<{ messageId: string; rank: number }, E>,
        ) =>
          pipe(
            ZeroQueryExternalSource.make(
              pipe(
                params,
                SignalContext.getMaybeSignalEffectValue,
                Effect.map(({ messageId, rank }) =>
                  queries.messageRoomOrder.getMessageRoomOrderEntry({ messageId, rank }),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.EitherFromSelf({
                      right: Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.EitherFromSelf({
                      right: Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
                      left: Error.Core.ZeroQueryError,
                    }),
                  }),
                ),
              ),
            ),
            Effect.map(
              Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderEntry", {
                captureStackTrace: true,
              }),
            ),
          ),
        _getMessageRoomOrderRange: <E = never>(
          messageId: SignalContext.MaybeSignalEffect<string, E>,
        ) =>
          pipe(
            ZeroQueryExternalSource.make(
              pipe(
                messageId,
                SignalContext.getMaybeSignalEffectValue,
                Effect.map((messageId) =>
                  queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.EitherFromSelf({
                      right: Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.EitherFromSelf({
                      right: Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
                      left: Error.Core.ZeroQueryError,
                    }),
                  }),
                ),
              ),
            ),
            Effect.map(
              Effect.map(
                Result.map(
                  Either.map((entries) =>
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
                          return Option.some(new MessageRoomOrderRange({ minRank, maxRank }));
                        },
                      }),
                    ),
                  ),
                ),
              ),
            ),
            Effect.map(
              Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderRange", {
                captureStackTrace: true,
              }),
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
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)))),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
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
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)))),
            Effect.withSpan("MessageRoomOrderService.removeMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {
  static getMessageRoomOrder = <E = never>(messageId: SignalContext.MaybeSignalEffect<string, E>) =>
    MessageRoomOrderService.use((messageRoomOrderService) =>
      messageRoomOrderService._getMessageRoomOrder(messageId),
    );

  static getMessageRoomOrderEntry = <E = never>(
    params: SignalContext.MaybeSignalEffect<{ messageId: string; rank: number }, E>,
  ) =>
    MessageRoomOrderService.use((messageRoomOrderService) =>
      messageRoomOrderService._getMessageRoomOrderEntry(params),
    );

  static getMessageRoomOrderRange = <E = never>(
    messageId: SignalContext.MaybeSignalEffect<string, E>,
  ) =>
    MessageRoomOrderService.use((messageRoomOrderService) =>
      messageRoomOrderService._getMessageRoomOrderRange(messageId),
    );
}
