import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageSlot } from "sheet-db-schema";

export class MessageSlotService extends Effect.Service<MessageSlotService>()("MessageSlotService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("client", () => SheetApisClient.get()),
    Effect.map(({ client }) => ({
      getMessageSlotData: (messageId: string) =>
        pipe(
          WebSocketClient.subscribeScoped(client, "messageSlot.getMessageSlotData", messageId),
          Effect.map(
            Effect.withSpan("MessageSlotService.getMessageSlotData subscription", {
              captureStackTrace: true,
            }),
          ),
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
          WebSocketClient.mutate(client, "messageSlot.upsertMessageSlotData", {
            messageId,
            ...data,
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
