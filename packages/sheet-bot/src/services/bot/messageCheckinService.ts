import { SheetApisClient } from "@/client/sheetApis";
import { Effect, Either, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageCheckin } from "sheet-db-schema";
import { Result } from "typhoon-core/schema";
import { UntilObserver } from "typhoon-core/signal";

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => {
        const waitForComplete = <Req, A>(
          name: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            WebSocketClient.subscribeScoped(client, name as any, request),
            UntilObserver.observeUntilScoped(Result.isComplete),
            Effect.map((result) => result.value as A),
          );

        const fetchEither = <Req, A>(
          name: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            waitForComplete<Req, Either.Either<A, unknown>>(name, request),
            Effect.flatMap(
              Either.match({
                onLeft: Effect.fail,
                onRight: Effect.succeed,
              }),
            ),
          );

        return {
          getMessageCheckinData: (messageId: string) =>
            pipe(
              fetchEither("messageCheckin.getMessageCheckinData", messageId),
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
              waitForComplete(
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
