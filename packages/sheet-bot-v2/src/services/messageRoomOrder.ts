import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    effect: pipe(
      Effect.all({ sheetApisClient: SheetApisClient }),
      Effect.map(({ sheetApisClient }) => ({
        getMessageRoomOrder: Effect.fn("MessageRoomOrderService.getMessageRoomOrder")(
          (messageId: string) =>
            sheetApisClient
              .get()
              .messageRoomOrder.getMessageRoomOrder({ urlParams: { messageId } }),
        ),
        upsertMessageRoomOrder: Effect.fn("MessageRoomOrderService.upsertMessageRoomOrder")(
          (
            messageId: string,
            data: {
              previousFills: ReadonlyArray<string>;
              fills: ReadonlyArray<string>;
              hour: number;
              rank: number;
              monitor: string | null | undefined;
            },
          ) =>
            sheetApisClient.get().messageRoomOrder.upsertMessageRoomOrder({
              payload: { messageId, data },
            }),
        ),
        decrementMessageRoomOrderRank: Effect.fn(
          "MessageRoomOrderService.decrementMessageRoomOrderRank",
        )((messageId: string) =>
          sheetApisClient.get().messageRoomOrder.decrementMessageRoomOrderRank({
            payload: { messageId },
          }),
        ),
        incrementMessageRoomOrderRank: Effect.fn(
          "MessageRoomOrderService.incrementMessageRoomOrderRank",
        )((messageId: string) =>
          sheetApisClient.get().messageRoomOrder.incrementMessageRoomOrderRank({
            payload: { messageId },
          }),
        ),
        getMessageRoomOrderEntry: Effect.fn("MessageRoomOrderService.getMessageRoomOrderEntry")(
          (messageId: string, rank: string) =>
            sheetApisClient.get().messageRoomOrder.getMessageRoomOrderEntry({
              urlParams: { messageId, rank },
            }),
        ),
        getMessageRoomOrderRange: Effect.fn("MessageRoomOrderService.getMessageRoomOrderRange")(
          (messageId: string) =>
            sheetApisClient
              .get()
              .messageRoomOrder.getMessageRoomOrderRange({ urlParams: { messageId } }),
        ),
        upsertMessageRoomOrderEntry: Effect.fn(
          "MessageRoomOrderService.upsertMessageRoomOrderEntry",
        )(
          (
            messageId: string,
            entries: ReadonlyArray<{
              rank: number;
              position: number;
              hour: number;
              team: string;
              tags: ReadonlyArray<string>;
              effectValue: number;
            }>,
          ) =>
            sheetApisClient.get().messageRoomOrder.upsertMessageRoomOrderEntry({
              payload: { messageId, entries },
            }),
        ),
        removeMessageRoomOrderEntry: Effect.fn(
          "MessageRoomOrderService.removeMessageRoomOrderEntry",
        )((messageId: string) =>
          sheetApisClient.get().messageRoomOrder.removeMessageRoomOrderEntry({
            payload: { messageId },
          }),
        ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
