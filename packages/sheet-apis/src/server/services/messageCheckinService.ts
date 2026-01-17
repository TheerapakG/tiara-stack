import { DBService } from "@/db";
import { Error, MessageCheckin, MessageCheckinMember } from "@/server/schema";
import { and, eq, gte, isNull } from "drizzle-orm";
import { Array, DateTime, Effect, pipe, Schema } from "effect";
import { messageCheckin, messageCheckinMember } from "sheet-db-schema";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass, Result } from "typhoon-core/schema";
import { ExternalComputed, SignalContext, ZeroQueryExternalSource } from "typhoon-core/signal";
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
        _getMessageCheckinData: <E = never>(
          messageId: SignalContext.MaybeSignalEffect<string, E>,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                pipe(
                  messageId,
                  SignalContext.getMaybeSignalEffectValue,
                  Effect.map((messageId) =>
                    zero.query.messageCheckin
                      .where("messageId", "=", messageId)
                      .where("deletedAt", "IS", null)
                      .one(),
                  ),
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
                        DefaultTaggedClass(MessageCheckin),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.EitherFromSelf({
                      right: Schema.OptionFromNullishOr(
                        DefaultTaggedClass(MessageCheckin),
                        undefined,
                      ),
                      left: Error.Core.ZeroQueryError,
                    }),
                  }),
                ),
              ),
            ),
            Effect.map(
              Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
                captureStackTrace: true,
              }),
            ),
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
                  Effect.die(makeDBQueryError("Failed to upsert message check-in data")),
              }),
            ),
            Effect.map(Array.headNonEmpty),
            Effect.flatMap(Schema.decode(DefaultTaggedClass(MessageCheckin))),
            Effect.withSpan("MessageCheckinService.upsertMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        _getMessageCheckinMembers: <E = never>(
          messageId: SignalContext.MaybeSignalEffect<string, E>,
        ) =>
          pipe(
            ZeroServiceTag,
            Effect.flatMap((zero) =>
              ZeroQueryExternalSource.make(
                pipe(
                  messageId,
                  SignalContext.getMaybeSignalEffectValue,
                  Effect.map((messageId) =>
                    zero.query.messageCheckinMember
                      .where("messageId", "=", messageId)
                      .where("deletedAt", "IS", null),
                  ),
                ),
              ),
            ),
            Effect.flatMap(ExternalComputed.make),
            Effect.map(
              Effect.flatMap(
                Schema.decode(
                  Result.ResultSchema({
                    optimistic: Schema.EitherFromSelf({
                      right: Schema.Array(DefaultTaggedClass(MessageCheckinMember)),
                      left: Error.Core.ZeroQueryError,
                    }),
                    complete: Schema.EitherFromSelf({
                      right: Schema.Array(DefaultTaggedClass(MessageCheckinMember)),
                      left: Error.Core.ZeroQueryError,
                    }),
                  }),
                ),
              ),
            ),
            Effect.map(
              Effect.withSpan("MessageCheckinService.getMessageCheckinMembers", {
                captureStackTrace: true,
              }),
            ),
          ),
        addMessageCheckinMembers: (messageId: string, memberIds: readonly string[]) =>
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
                  target: [messageCheckinMember.messageId, messageCheckinMember.memberId],
                  set: { deletedAt: null, checkinAt: null },
                })
                .returning(),
            ),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageCheckinMember)))),
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
                        pipe(now, DateTime.subtractDuration("1 hour"), DateTime.toDate),
                      ),
                    ),
                  )
                  .returning(),
              ),
            ),
            Effect.map(Array.head),
            Effect.flatMap(
              Schema.decode(Schema.OptionFromSelf(DefaultTaggedClass(MessageCheckinMember))),
            ),
            Effect.withSpan("MessageCheckinService.setMessageCheckinMemberCheckinAt", {
              captureStackTrace: true,
            }),
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
              Schema.decode(Schema.OptionFromSelf(DefaultTaggedClass(MessageCheckinMember))),
            ),
            Effect.withSpan("MessageCheckinService.removeMessageCheckinMember", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DBService.Default, DB.DBSubscriptionContext.Default],
    accessors: true,
  },
) {
  static getMessageCheckinData = <E = never>(
    messageId: SignalContext.MaybeSignalEffect<string, E>,
  ) =>
    MessageCheckinService.use((messageCheckinService) =>
      messageCheckinService._getMessageCheckinData(messageId),
    );

  static getMessageCheckinMembers = <E = never>(
    messageId: SignalContext.MaybeSignalEffect<string, E>,
  ) =>
    MessageCheckinService.use((messageCheckinService) =>
      messageCheckinService._getMessageCheckinMembers(messageId),
    );
}
