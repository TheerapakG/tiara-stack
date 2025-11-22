import { SheetApisClient } from "@/client/sheetApis";
import { Effect, Either, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageCheckin } from "sheet-db-schema";
import { Schema } from "sheet-apis";
import { Result } from "typhoon-core/schema";

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => {
        const decodeResult = <Req, A>(
          handler: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            WebSocketClient.once(
              client,
              handler as any,
              request,
            ) as Effect.Effect<Result.Result<A>, never, never>,
            Effect.orDie,
            Effect.flatMap((result) =>
              Result.match({
                onOptimistic: Effect.succeed,
                onComplete: Effect.succeed,
              })(result),
            ),
          );

        const decodeEither = <Req, A>(
          handler: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            decodeResult<Req, Either.Either<A, unknown>>(handler, request),
            Effect.flatMap(
              Either.match({
                onLeft: Effect.die,
                onRight: Effect.succeed,
              }),
            ),
          );

        return {
          getMessageCheckinData: (messageId: string) =>
            pipe(
              decodeEither<string, Schema.MessageCheckin>(
                "messageCheckin.getMessageCheckinData",
                messageId,
              ),
              Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
                captureStackTrace: true,
              }),
            ),
          upsertMessageCheckinData: (
            messageId: string,
            data: Omit<
              typeof messageCheckin.$inferInsert,
              "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
            >,
          ) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.upsertMessageCheckinData",
                { messageId, ...data },
              ),
              Effect.withSpan(
                "MessageCheckinService.upsertMessageCheckinData",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          getMessageCheckinMembers: (messageId: string) =>
            pipe(
              decodeResult<string, ReadonlyArray<Schema.MessageCheckinMember>>(
                "messageCheckin.getMessageCheckinMembers",
                messageId,
              ),
              Effect.withSpan(
                "MessageCheckinService.getMessageCheckinMembers",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          addMessageCheckinMembers: (messageId: string, memberIds: string[]) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.addMessageCheckinMembers",
                { messageId, memberIds },
              ),
              Effect.withSpan(
                "MessageCheckinService.addMessageCheckinMembers",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          setMessageCheckinMemberCheckinAt: (
            messageId: string,
            memberId: string,
          ) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.setMessageCheckinMemberCheckinAt",
                { messageId, memberId },
              ),
              Effect.withSpan(
                "MessageCheckinService.setMessageCheckinMemberCheckinAt",
                { captureStackTrace: true },
              ),
            ),
          removeMessageCheckinMember: (messageId: string, memberId: string) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.removeMessageCheckinMember",
                { messageId, memberId },
              ),
              Effect.withSpan(
                "MessageCheckinService.removeMessageCheckinMember",
                { captureStackTrace: true },
              ),
            ),
        };
      }),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
