import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe } from "effect";

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => ({
        getMessageCheckinData: (messageId: string) =>
          pipe(
            client.messageCheckin.getMessageCheckinData({ urlParams: { messageId } }),
            Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageCheckinData: (
          messageId: string,
          data: {
            initialMessage: string;
            hour: number;
            channelId: string;
            roleId?: string | null | undefined;
          },
        ) =>
          pipe(
            client.messageCheckin.upsertMessageCheckinData({
              payload: {
                messageId,
                data,
              },
            }),
            Effect.withSpan("MessageCheckinService.upsertMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        getMessageCheckinMembers: (messageId: string) =>
          pipe(
            client.messageCheckin.getMessageCheckinMembers({ urlParams: { messageId } }),
            Effect.withSpan("MessageCheckinService.getMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        addMessageCheckinMembers: (messageId: string, memberIds: string[]) =>
          pipe(
            client.messageCheckin.addMessageCheckinMembers({ payload: { messageId, memberIds } }),
            Effect.withSpan("MessageCheckinService.addMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        setMessageCheckinMemberCheckinAt: (
          messageId: string,
          memberId: string,
          checkinAt: number,
        ) =>
          pipe(
            client.messageCheckin.setMessageCheckinMemberCheckinAt({
              payload: { messageId, memberId, checkinAt },
            }),
            Effect.withSpan("MessageCheckinService.setMessageCheckinMemberCheckinAt", {
              captureStackTrace: true,
            }),
          ),
        removeMessageCheckinMember: (messageId: string, memberId: string) =>
          pipe(
            client.messageCheckin.removeMessageCheckinMember({ payload: { messageId, memberId } }),
            Effect.withSpan("MessageCheckinService.removeMessageCheckinMember", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
