import { SheetApisClient } from "@/client/sheetApis";
import { Effect, Either, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageRoomOrder, messageRoomOrderEntry } from "sheet-db-schema";
import { Schema } from "sheet-apis";
import { Result } from "typhoon-core/schema";

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
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
          getMessageRoomOrder: (messageId: string) =>
            pipe(
              decodeEither<string, Schema.MessageRoomOrder>(
                "messageRoomOrder.getMessageRoomOrder",
                messageId,
              ),
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
              decodeResult<
                { messageId: string; rank: number },
                ReadonlyArray<Schema.MessageRoomOrderEntry>
              >("messageRoomOrder.getMessageRoomOrderEntry", {
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
              decodeEither<string, Schema.MessageRoomOrderRange>(
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
