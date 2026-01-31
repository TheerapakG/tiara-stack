import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe } from "effect";
import type { messageSlot } from "sheet-db-schema";

export class MessageSlotService extends Effect.Service<MessageSlotService>()("MessageSlotService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("client", () => SheetApisClient.get()),
    Effect.map(({ client }) => ({
      getMessageSlotData: (messageId: string) =>
        pipe(
          client.messageSlot.getMessageSlotData({ urlParams: { messageId } }),
          Effect.withSpan("MessageSlotService.getMessageSlotData", {
            captureStackTrace: true,
          }),
        ),
      upsertMessageSlotData: (
        messageId: string,
        data: Omit<
          typeof messageSlot.$inferInsert,
          "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
        >,
      ) =>
        pipe(
          client.messageSlot.upsertMessageSlotData({
            payload: { messageId, day: data.day },
          }),
          Effect.withSpan("MessageSlotService.upsertMessageSlotData", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
