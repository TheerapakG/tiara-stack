import { DB } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { Array, Data, Effect, Option, pipe } from "effect";
import { messageSlot } from "sheet-db-schema";
import { Computed } from "typhoon-core/signal";
import { DBSubscriptionContext } from "typhoon-server/db";

type MessageSlotInsert = typeof messageSlot.$inferInsert;
type MessageSlotSelect = typeof messageSlot.$inferSelect;

export class MessageSlot extends Data.TaggedClass("MessageSlot")<{
  id: number;
  messageId: string;
  day: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect = (select: MessageSlotSelect) =>
    new MessageSlot({
      id: select.id,
      messageId: select.messageId,
      day: select.day,
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
}

export class MessageSlotService extends Effect.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DB),
      Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
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
            Computed.map(Option.map(MessageSlot.fromDbSelect)),
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
                }),
            ),
            Effect.withSpan("MessageSlotService.upsertMessageSlotData", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
