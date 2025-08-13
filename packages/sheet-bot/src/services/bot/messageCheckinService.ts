import { subHours } from "date-fns/fp";
import { and, eq, gte, isNull } from "drizzle-orm";
import { Array, Effect, pipe } from "effect";
import { messageCheckin, messageCheckinMember } from "sheet-db-schema";
import { DBSubscriptionContext } from "typhoon-server/db";
import { computed } from "typhoon-server/signal";
import { DB } from "../../db";

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("db", () => DB),
      Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
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
            Effect.flatMap((c) => computed(pipe(c, Effect.map(Array.head)))),
            Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageCheckinData: (
          messageId: string,
          data: Pick<
            typeof messageCheckin.$inferInsert,
            "initialMessage" | "hour" | "channelId" | "roleId"
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
                }),
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
                }),
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
            dbSubscriptionContext.mutateQuery(
              db
                .update(messageCheckinMember)
                .set({ checkinAt: new Date() })
                .where(
                  and(
                    eq(messageCheckinMember.messageId, messageId),
                    eq(messageCheckinMember.memberId, memberId),
                    isNull(messageCheckinMember.deletedAt),
                    gte(
                      messageCheckinMember.createdAt,
                      pipe(new Date(), subHours(1)),
                    ),
                  ),
                )
                .returning(),
            ),
            Effect.withSpan(
              "MessageCheckinService.setMessageCheckinMemberCheckinAt",
              { captureStackTrace: true },
            ),
          ),
        removeMessageCheckinMember: (messageId: string, memberId: string) =>
          pipe(
            dbSubscriptionContext.mutateQuery(
              db
                .update(messageCheckinMember)
                .set({ deletedAt: new Date() })
                .where(
                  and(
                    eq(messageCheckinMember.messageId, messageId),
                    eq(messageCheckinMember.memberId, memberId),
                    isNull(messageCheckinMember.deletedAt),
                  ),
                ),
            ),
            Effect.withSpan(
              "MessageCheckinService.removeMessageCheckinMember",
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
