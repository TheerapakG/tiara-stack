import { DBService } from "@/db";
import { MessageSlot } from "@/server/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Array, Effect, pipe, Schema } from "effect";
import { messageSlot } from "sheet-db-schema";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { Computed } from "typhoon-core/signal";
import { DB } from "typhoon-server/db";

type MessageSlotInsert = typeof messageSlot.$inferInsert;

export class MessageSlotService extends Effect.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DBService),
      Effect.bind("dbSubscriptionContext", () => DB.DBSubscriptionContext),
      Effect.map(({ db, dbSubscriptionContext }) => ({
        getMessageSlotData: (messageId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(messageSlot)
                .where(
                  and(
                    eq(messageSlot.messageId, messageId),
                    isNull(messageSlot.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(DefaultTaggedClass(MessageSlot)),
              ),
            ),
            Effect.withSpan("MessageSlotService.getMessageSlotData", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageSlotData: (
          messageId: string,
          data: Omit<
            MessageSlotInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >,
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(messageSlot)
                .values({
                  messageId,
                  ...data,
                })
                .onConflictDoUpdate({
                  target: [messageSlot.messageId],
                  set: {
                    ...data,
                  },
                })
                .returning(),
            ),
            Effect.flatMap(
              Array.match({
                onNonEmpty: Effect.succeed,
                onEmpty: () =>
                  Effect.die(
                    makeDBQueryError("Failed to upsert message slot data"),
                  ),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(Schema.decode(DefaultTaggedClass(MessageSlot))),
            Effect.withSpan("MessageSlotService.upsertMessageSlotData", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
