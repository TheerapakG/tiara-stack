import { DBService } from "@/db";
import { MessageCheckin, MessageCheckinMember } from "@/server/schema";
import { and, eq, gte, isNull } from "drizzle-orm";
import { Array, DateTime, Effect, pipe, Schema } from "effect";
import { messageCheckin, messageCheckinMember } from "sheet-db-schema";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass, Result } from "typhoon-core/schema";
import {
  Computed,
  ExternalComputed,
  ZeroQueryExternalSource,
} from "typhoon-core/signal";
import { DB } from "typhoon-server/db";
import { ZeroServiceTag } from "@/db/zeroService";

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
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.messageCheckin
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
                  optimistic: Schema.OptionFromNullishOr(
                    DefaultTaggedClass(MessageCheckin),
                    undefined,
                  ),
                  complete: Schema.OptionFromNullishOr(
                    DefaultTaggedClass(MessageCheckin),
                    undefined,
                  ),
                }),
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

            Effect.flatMap(
              Array.match({
                onNonEmpty: Effect.succeed,
                onEmpty: () =>
                  Effect.die(
                    makeDBQueryError("Failed to upsert message checkin data"),
                  ),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(Schema.decode(DefaultTaggedClass(MessageCheckin))),
            Effect.withSpan("MessageCheckinService.upsertMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        getMessageCheckinMembers: (messageId: string) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                zero.query.messageCheckinMember
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
                    DefaultTaggedClass(MessageCheckinMember),
                  ),
                  complete: Schema.Array(
                    DefaultTaggedClass(MessageCheckinMember),
                  ),
                }),
              ),
            ),
            Effect.withSpan("MessageCheckinService.getMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        addMessageCheckinMembers: (
          messageId: string,
          memberIds: readonly string[],
        ) =>
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
                Schema.Array(DefaultTaggedClass(MessageCheckinMember)),
              ),
            ),
            Effect.withSpan("MessageCheckinService.addMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        setMessageCheckinMemberCheckinAt: ({
          messageId,
          memberId,
        }: {
          messageId: string;
          memberId: string;
        }) =>
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
                Schema.OptionFromSelf(DefaultTaggedClass(MessageCheckinMember)),
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
                Schema.OptionFromSelf(DefaultTaggedClass(MessageCheckinMember)),
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
