import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe } from "effect";
import type { messageRoomOrder, messageRoomOrderEntry } from "sheet-db-schema";

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => ({
        getMessageRoomOrder: (messageId: string) =>
          pipe(
            client.messageRoomOrder.getMessageRoomOrder({ urlParams: { messageId } }),
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        decrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            client.messageRoomOrder.decrementMessageRoomOrderRank({ payload: { messageId } }),
            Effect.withSpan("MessageRoomOrderService.decrementMessageRoomOrderRank", {
              captureStackTrace: true,
            }),
          ),
        incrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            client.messageRoomOrder.incrementMessageRoomOrderRank({ payload: { messageId } }),
            Effect.withSpan("MessageRoomOrderService.incrementMessageRoomOrderRank", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageRoomOrder: (
          messageId: string,
          data: Omit<
            typeof messageRoomOrder.$inferInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >,
        ) =>
          pipe(
            client.messageRoomOrder.upsertMessageRoomOrder({
              payload: {
                messageId,
                previousFills: data.previousFills,
                fills: data.fills,
                hour: data.hour,
                rank: data.rank,
                monitor: data.monitor ?? undefined,
              },
            }),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderEntry: (messageId: string, rank: number) =>
          pipe(
            client.messageRoomOrder.getMessageRoomOrderEntry({
              urlParams: { messageId, rank: String(rank) },
            }),
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderRange: (messageId: string) =>
          pipe(
            client.messageRoomOrder.getMessageRoomOrderRange({ urlParams: { messageId } }),
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderRange", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageRoomOrderEntry: (
          messageId: string,
          entries: Omit<
            typeof messageRoomOrderEntry.$inferInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >[],
        ) =>
          pipe(
            client.messageRoomOrder.upsertMessageRoomOrderEntry({
              payload: {
                messageId,
                entries: entries.map((entry) => ({
                  rank: entry.rank,
                  position: entry.position,
                  hour: entry.hour,
                  team: entry.team,
                  tags: entry.tags,
                  effectValue: entry.effectValue,
                })),
              },
            }),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
          ),
        removeMessageRoomOrderEntry: (messageId: string) =>
          pipe(
            client.messageRoomOrder.removeMessageRoomOrderEntry({ payload: { messageId } }),
            Effect.withSpan("MessageRoomOrderService.removeMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
