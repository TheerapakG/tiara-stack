import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageCheckin } from "sheet-db-schema";

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => ({
        getMessageCheckinData: (messageId: string) =>
          pipe(
            WebSocketClient.subscribeScoped(
              client,
              "messageCheckin.getMessageCheckinData",
              messageId,
            ),
            Effect.map(
              Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
                captureStackTrace: true,
              }),
            ),
          ),
        upsertMessageCheckinData: (
          messageId: string,
          data: Omit<
            typeof messageCheckin.$inferInsert,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
          >,
        ) =>
          pipe(
            WebSocketClient.mutate(
              client,
              "messageCheckin.upsertMessageCheckinData",
              { messageId, ...data },
            ),
            Effect.withSpan("MessageCheckinService.upsertMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        getMessageCheckinMembers: (messageId: string) =>
          pipe(
            WebSocketClient.subscribeScoped(
              client,
              "messageCheckin.getMessageCheckinMembers",
              messageId,
            ),
            Effect.map(
              Effect.withSpan(
                "MessageCheckinService.getMessageCheckinMembers",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          ),
        addMessageCheckinMembers: (messageId: string, memberIds: string[]) =>
          pipe(
            WebSocketClient.mutate(
              client,
              "messageCheckin.addMessageCheckinMembers",
              { messageId, memberIds },
            ),
            Effect.withSpan("MessageCheckinService.addMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        setMessageCheckinMemberCheckinAt: (
          messageId: string,
          memberId: string,
        ) =>
          pipe(
            WebSocketClient.mutate(
              client,
              "messageCheckin.setMessageCheckinMemberCheckinAt",
              { messageId, memberId },
            ),
            Effect.withSpan(
              "MessageCheckinService.setMessageCheckinMemberCheckinAt",
              { captureStackTrace: true },
            ),
          ),
        removeMessageCheckinMember: (messageId: string, memberId: string) =>
          pipe(
            WebSocketClient.mutate(
              client,
              "messageCheckin.removeMessageCheckinMember",
              { messageId, memberId },
            ),
            Effect.withSpan(
              "MessageCheckinService.removeMessageCheckinMember",
              { captureStackTrace: true },
            ),
          ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
