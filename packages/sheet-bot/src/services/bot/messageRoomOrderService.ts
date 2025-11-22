import { SheetApisClient } from "@/client/sheetApis";
import { Effect, Either, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageRoomOrder, messageRoomOrderEntry } from "sheet-db-schema";
import { Result } from "typhoon-core/schema";
import { UntilObserver } from "typhoon-core/signal";

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
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
          getMessageRoomOrder: (messageId: string) =>
            pipe(
              fetchEither("messageRoomOrder.getMessageRoomOrder", messageId),
              Effect.withSpan("MessageRoomOrderService.getMessageRoomOrder", {
                captureStackTrace: true,
              }),
            ),
          decrementMessageRoomOrderRank: (messageId: string) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageRoomOrder.decrementMessageRoomOrderRank",
                { messageId },
              ),
              Effect.withSpan(
                "MessageRoomOrderService.decrementMessageRoomOrderRank",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          incrementMessageRoomOrderRank: (messageId: string) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageRoomOrder.incrementMessageRoomOrderRank",
                { messageId },
              ),
              Effect.withSpan(
                "MessageRoomOrderService.incrementMessageRoomOrderRank",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          upsertMessageRoomOrder: (
            messageId: string,
            data: Omit<
              typeof messageRoomOrder.$inferInsert,
              "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
            >,
          ) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageRoomOrder.upsertMessageRoomOrder",
                { messageId, ...data },
              ),
              Effect.withSpan(
                "MessageRoomOrderService.upsertMessageRoomOrder",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          getMessageRoomOrderEntry: (messageId: string, rank: number) =>
            pipe(
              waitForComplete("messageRoomOrder.getMessageRoomOrderEntry", {
                messageId,
                rank,
              }),
              Effect.withSpan(
                "MessageRoomOrderService.getMessageRoomOrderEntry",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          getMessageRoomOrderRange: (messageId: string) =>
            pipe(
              fetchEither(
                "messageRoomOrder.getMessageRoomOrderRange",
                messageId,
              ),
              Effect.withSpan(
                "MessageRoomOrderService.getMessageRoomOrderRange",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          upsertMessageRoomOrderEntry: (
            messageId: string,
            hour: number,
            entries: Omit<
              typeof messageRoomOrderEntry.$inferInsert,
              "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
            >[],
          ) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageRoomOrder.upsertMessageRoomOrderEntry",
                {
                  messageId,
                  hour,
                  entries,
                },
              ),
              Effect.withSpan(
                "MessageRoomOrderService.upsertMessageRoomOrderEntry",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          removeMessageRoomOrderEntry: (messageId: string) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageRoomOrder.removeMessageRoomOrderEntry",
                { messageId },
              ),
              Effect.withSpan(
                "MessageRoomOrderService.removeMessageRoomOrderEntry",
                {
                  captureStackTrace: true,
                },
              ),
            ),
        };
      }),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
