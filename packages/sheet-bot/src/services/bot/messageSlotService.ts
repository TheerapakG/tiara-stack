import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageSlot } from "sheet-db-schema";

export class MessageSlotService extends Effect.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => {
        const subscribe = (handler: string, request: unknown) =>
          pipe(
            WebSocketClient.subscribeScoped(client, handler as any, request),
          );

        return {
          getMessageSlotData: (messageId: string) =>
            pipe(
              subscribe("messageSlot.getMessageSlotData", messageId),
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
              WebSocketClient.mutate(
                client,
                "messageSlot.upsertMessageSlotData",
                { messageId, ...data },
              ),
              Effect.withSpan("MessageSlotService.upsertMessageSlotData", {
                captureStackTrace: true,
              }),
            ),
        };
      }),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
