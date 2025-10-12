import { DBService } from "@/db";
import { MessageCheckin, MessageCheckinMember } from "@/server/schema";
import { and, eq, gte, isNull } from "drizzle-orm";
import { Array, DateTime, Effect, pipe, Schema } from "effect";
import { messageCheckin, messageCheckinMember } from "sheet-db-schema";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { Computed } from "typhoon-core/signal";
import { DB } from "typhoon-server/db";

type MessageCheckinInsert = typeof messageCheckin.$inferInsert;

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DBService),
      Effect.bind("dbSubscriptionContext", () => DB.DBSubscriptionContext),
      Effect.map(({ db, dbSubscriptionContext }) => ({
        getMessageCheckinData: (messageId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(messageCheckin)
                .where(
                  and(
                    eq(messageCheckin.messageId, messageId),
                    isNull(messageCheckin.deletedAt),
                  ),
                ),
            ),
            Computed.map(Array.head),
            Computed.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageCheckin),
                ),
              ),
            ),
            Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageCheckinData: (
          messageId: string,
          data: Omit<
            MessageCheckinInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >,
        ) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(messageCheckin)
                .values({
                  messageId,
                  ...data,
                })
                .onConflictDoUpdate({
                  target: [messageCheckin.messageId],
                  set: {
                    ...data,
                  },
                })
                .returning(),
            ),
            Effect.map(Array.head),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageCheckin),
                ),
              ),
            ),
            Effect.withSpan("MessageCheckinService.upsertMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        getMessageCheckinMembers: (messageId: string) =>
          pipe(
            dbSubscriptionContext.subscribeQuery(
              db
                .select()
                .from(messageCheckinMember)
                .where(
                  and(
                    eq(messageCheckinMember.messageId, messageId),
                    isNull(messageCheckinMember.deletedAt),
                  ),
                ),
            ),
            Computed.flatMap(
              Schema.decode(
                Schema.Array(
                  DefaultTaggedClass.DefaultTaggedClass(MessageCheckinMember),
                ),
              ),
            ),
            Effect.withSpan("MessageCheckinService.getMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        addMessageCheckinMembers: (messageId: string, memberIds: string[]) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .insert(messageCheckinMember)
                .values(
                  pipe(
                    memberIds,
                    Array.map((memberId) => ({
                      messageId,
                      memberId,
                      checkinAt: null,
                    })),
                  ),
                )
                .onConflictDoUpdate({
                  target: [
                    messageCheckinMember.messageId,
                    messageCheckinMember.memberId,
                  ],
                  set: { deletedAt: null, checkinAt: null },
                })
                .returning(),
            ),
            Effect.flatMap(
              Schema.decode(
                Schema.Array(
                  DefaultTaggedClass.DefaultTaggedClass(MessageCheckinMember),
                ),
              ),
            ),
            Effect.withSpan("MessageCheckinService.addMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        setMessageCheckinMemberCheckinAt: (
          messageId: string,
          memberId: string,
        ) =>
          pipe(
            DateTime.now,
            Effect.flatMap((now) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .update(messageCheckinMember)
                  .set({ checkinAt: DateTime.toDate(now) })
                  .where(
                    and(
                      eq(messageCheckinMember.messageId, messageId),
                      eq(messageCheckinMember.memberId, memberId),
                      isNull(messageCheckinMember.deletedAt),
                      gte(
                        messageCheckinMember.createdAt,
                        pipe(
                          now,
                          DateTime.subtractDuration("1 hour"),
                          DateTime.toDate,
                        ),
                      ),
                    ),
                  )
                  .returning(),
              ),
            ),
            Effect.map(Array.head),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageCheckinMember),
                ),
              ),
            ),
            Effect.withSpan(
              "MessageCheckinService.setMessageCheckinMemberCheckinAt",
              { captureStackTrace: true },
            ),
          ),
        removeMessageCheckinMember: (messageId: string, memberId: string) =>
          pipe(
            DateTime.now,
            Effect.flatMap((now) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .update(messageCheckinMember)
                  .set({ deletedAt: DateTime.toDate(now) })
                  .where(
                    and(
                      eq(messageCheckinMember.messageId, messageId),
                      eq(messageCheckinMember.memberId, memberId),
                      isNull(messageCheckinMember.deletedAt),
                    ),
                  )
                  .returning(),
              ),
            ),
            Effect.map(Array.head),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromSelf(
                  DefaultTaggedClass.DefaultTaggedClass(MessageCheckinMember),
                ),
              ),
            ),
            Effect.withSpan(
              "MessageCheckinService.removeMessageCheckinMember",
              { captureStackTrace: true },
            ),
          ),
      })),
    ),
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
