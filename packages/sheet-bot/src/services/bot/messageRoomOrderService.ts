import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe, Either, Option, Scope } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageRoomOrder, messageRoomOrderEntry } from "sheet-db-schema";
import { Schema } from "sheet-apis";
import { DependencySignal } from "typhoon-core/signal";
import { Result, RpcResult } from "typhoon-core/schema";

type RpcSignal<Response> = Effect.Effect<
  DependencySignal.DependencySignal<
    RpcResult.RpcResult<Response, unknown>,
    never,
    never
  >,
  never,
  Scope.Scope
>;

type MessageRoomOrderResponse = Result.Result<
  Either.Either<Schema.MessageRoomOrder, Schema.Error.Core.ArgumentError>,
  Either.Either<Schema.MessageRoomOrder, Schema.Error.Core.ArgumentError>
>;

type MessageRoomOrderEntryResponse = Result.Result<
  ReadonlyArray<Schema.MessageRoomOrderEntry>,
  ReadonlyArray<Schema.MessageRoomOrderEntry>
>;

type MessageRoomOrderRangeResponse = Result.Result<
  Option.Option<Schema.MessageRoomOrderRange>,
  Option.Option<Schema.MessageRoomOrderRange>
>;

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => {
        const subscribe = <Response>(
          handler: string,
          request: unknown,
        ): RpcSignal<Response> =>
          pipe(
            WebSocketClient.subscribeScoped(client, handler as any, request),
            Effect.orDie,
          ) as RpcSignal<Response>;

        return {
          getMessageRoomOrder: (messageId: string) =>
            pipe(
              subscribe<MessageRoomOrderResponse>(
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
              subscribe<MessageRoomOrderEntryResponse>(
                "messageRoomOrder.getMessageRoomOrderEntry",
                { messageId, rank },
              ),
              Effect.withSpan(
                "MessageRoomOrderService.getMessageRoomOrderEntry",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          getMessageRoomOrderRange: (messageId: string) =>
            pipe(
              subscribe<MessageRoomOrderRangeResponse>(
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
