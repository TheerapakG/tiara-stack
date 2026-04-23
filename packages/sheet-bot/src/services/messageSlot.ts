import { Effect, Layer, Context } from "effect";
import { SheetApisClient } from "./sheetApis";

export class MessageSlotService extends Context.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    make: Effect.gen(function* () {
      const sheetApisClient = yield* SheetApisClient;

      return {
        getMessageSlotData: Effect.fn("MessageSlotService.getMessageSlotData")(function* (
          messageId: string,
        ) {
          return yield* sheetApisClient.get().messageSlot.getMessageSlotData({
            query: { messageId },
          });
        }),
        upsertMessageSlotData: Effect.fn("MessageSlotService.upsertMessageSlotData")(function* (
          messageId: string,
          data: {
            day: number;
            guildId: string | null;
            messageChannelId: string | null;
            createdByUserId: string | null;
          },
        ) {
          return yield* sheetApisClient.get().messageSlot.upsertMessageSlotData({
            payload: { messageId, data },
          });
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(MessageSlotService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
  );
}
