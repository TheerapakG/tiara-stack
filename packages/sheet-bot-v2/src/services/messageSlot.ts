import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class MessageSlotService extends Effect.Service<MessageSlotService>()("MessageSlotService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      getMessageSlotData: Effect.fn("MessageSlotService.getMessageSlotData")((messageId: string) =>
        sheetApisClient.get().messageSlot.getMessageSlotData({ urlParams: { messageId } }),
      ),
      upsertMessageSlotData: Effect.fn("MessageSlotService.upsertMessageSlotData")(
        (messageId: string, day: number) =>
          sheetApisClient.get().messageSlot.upsertMessageSlotData({
            payload: { messageId, day },
          }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
