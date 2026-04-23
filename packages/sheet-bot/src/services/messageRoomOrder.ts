import { Effect, Layer, Context } from "effect";
import { SheetApisClient } from "./sheetApis";

export class MessageRoomOrderService extends Context.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    make: Effect.gen(function* () {
      const sheetApisClient = yield* SheetApisClient;

      return {
        getMessageRoomOrder: Effect.fn("MessageRoomOrderService.getMessageRoomOrder")(function* (
          messageId: string,
        ) {
          return yield* sheetApisClient.get().messageRoomOrder.getMessageRoomOrder({
            query: { messageId },
          });
        }),
        upsertMessageRoomOrder: Effect.fn("MessageRoomOrderService.upsertMessageRoomOrder")(
          function* (
            messageId: string,
            data: {
              previousFills: ReadonlyArray<string>;
              fills: ReadonlyArray<string>;
              hour: number;
              rank: number;
              monitor: string | null | undefined;
              guildId: string | null;
              messageChannelId: string | null;
              createdByUserId: string | null;
            },
          ) {
            return yield* sheetApisClient.get().messageRoomOrder.upsertMessageRoomOrder({
              payload: { messageId, data },
            });
          },
        ),
        persistMessageRoomOrder: Effect.fn("MessageRoomOrderService.persistMessageRoomOrder")(
          function* (
            messageId: string,
            payload: {
              data: {
                previousFills: ReadonlyArray<string>;
                fills: ReadonlyArray<string>;
                hour: number;
                rank: number;
                monitor: string | null | undefined;
                guildId: string | null;
                messageChannelId: string | null;
                createdByUserId: string | null;
              };
              entries: ReadonlyArray<{
                rank: number;
                position: number;
                hour: number;
                team: string;
                tags: ReadonlyArray<string>;
                effectValue: number;
              }>;
            },
          ) {
            return yield* sheetApisClient.get().messageRoomOrder.persistMessageRoomOrder({
              payload: { messageId, data: payload.data, entries: payload.entries },
            });
          },
        ),
        decrementMessageRoomOrderRank: Effect.fn(
          "MessageRoomOrderService.decrementMessageRoomOrderRank",
        )(function* (messageId: string) {
          return yield* sheetApisClient.get().messageRoomOrder.decrementMessageRoomOrderRank({
            payload: { messageId },
          });
        }),
        incrementMessageRoomOrderRank: Effect.fn(
          "MessageRoomOrderService.incrementMessageRoomOrderRank",
        )(function* (messageId: string) {
          return yield* sheetApisClient.get().messageRoomOrder.incrementMessageRoomOrderRank({
            payload: { messageId },
          });
        }),
        getMessageRoomOrderEntry: Effect.fn("MessageRoomOrderService.getMessageRoomOrderEntry")(
          function* (messageId: string, rank: string) {
            return yield* sheetApisClient.get().messageRoomOrder.getMessageRoomOrderEntry({
              query: { messageId, rank },
            });
          },
        ),
        getMessageRoomOrderRange: Effect.fn("MessageRoomOrderService.getMessageRoomOrderRange")(
          function* (messageId: string) {
            return yield* sheetApisClient.get().messageRoomOrder.getMessageRoomOrderRange({
              query: { messageId },
            });
          },
        ),
        upsertMessageRoomOrderEntry: Effect.fn(
          "MessageRoomOrderService.upsertMessageRoomOrderEntry",
        )(function* (
          messageId: string,
          entries: ReadonlyArray<{
            rank: number;
            position: number;
            hour: number;
            team: string;
            tags: ReadonlyArray<string>;
            effectValue: number;
          }>,
        ) {
          return yield* sheetApisClient.get().messageRoomOrder.upsertMessageRoomOrderEntry({
            payload: { messageId, entries },
          });
        }),
        removeMessageRoomOrderEntry: Effect.fn(
          "MessageRoomOrderService.removeMessageRoomOrderEntry",
        )(function* (messageId: string) {
          return yield* sheetApisClient.get().messageRoomOrder.removeMessageRoomOrderEntry({
            payload: { messageId },
          });
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(MessageRoomOrderService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
  );
}
