import { DBService } from "@/db";
import { subHours } from "date-fns/fp";
import { and, eq, gte, isNull } from "drizzle-orm";
import { Array, Data, DateTime, Effect, Option, pipe } from "effect";
import { messageCheckin, messageCheckinMember } from "sheet-db-schema";
import { Computed } from "typhoon-core/signal";
import { DB } from "typhoon-server/db";

type MessageCheckinInsert = typeof messageCheckin.$inferInsert;
type MessageCheckinSelect = typeof messageCheckin.$inferSelect;
type MessageCheckinMemberSelect = typeof messageCheckinMember.$inferSelect;

export class MessageCheckin extends Data.TaggedClass("MessageCheckin")<{
  id: number;
  messageId: string;
  initialMessage: string;
  hour: number;
  channelId: string;
  roleId: Option.Option<string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect = (select: MessageCheckinSelect) =>
    new MessageCheckin({
      id: select.id,
      messageId: select.messageId,
      initialMessage: select.initialMessage,
      hour: select.hour,
      channelId: select.channelId,
      roleId: Option.fromNullable(select.roleId),
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
}

export class MessageCheckinMember extends Data.TaggedClass(
  "MessageCheckinMember",
)<{
  id: number;
  messageId: string;
  memberId: string;
  checkinAt: Option.Option<Date>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect = (select: MessageCheckinMemberSelect) =>
    new MessageCheckinMember({
      id: select.id,
      messageId: select.messageId,
      memberId: select.memberId,
      checkinAt: Option.fromNullable(select.checkinAt),
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
}

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
            Computed.map(Option.map(MessageCheckin.fromDbSelect)),
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
            Computed.map(Array.map(MessageCheckinMember.fromDbSelect)),
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
                        pipe(DateTime.toDate(now), subHours(1)),
                      ),
                    ),
                  )
                  .returning(),
              ),
            ),
            Effect.map(Array.head),
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
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
