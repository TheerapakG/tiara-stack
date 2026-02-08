import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    effect: pipe(
      Effect.all({ sheetApisClient: SheetApisClient }),
      Effect.map(({ sheetApisClient }) => ({
        getMessageCheckinData: Effect.fn("MessageCheckinService.getMessageCheckinData")(
          (messageId: string) =>
            sheetApisClient
              .get()
              .messageCheckin.getMessageCheckinData({ urlParams: { messageId } }),
        ),
        upsertMessageCheckinData: Effect.fn("MessageCheckinService.upsertMessageCheckinData")(
          (
            messageId: string,
            initialMessage: string,
            hour: number,
            channelId: string,
            roleId: string | undefined,
          ) =>
            sheetApisClient.get().messageCheckin.upsertMessageCheckinData({
              payload: { messageId, initialMessage, hour, channelId, roleId },
            }),
        ),
        getMessageCheckinMembers: Effect.fn("MessageCheckinService.getMessageCheckinMembers")(
          (messageId: string) =>
            sheetApisClient
              .get()
              .messageCheckin.getMessageCheckinMembers({ urlParams: { messageId } }),
        ),
        addMessageCheckinMembers: Effect.fn("MessageCheckinService.addMessageCheckinMembers")(
          (messageId: string, memberIds: ReadonlyArray<string>) =>
            sheetApisClient.get().messageCheckin.addMessageCheckinMembers({
              payload: { messageId, memberIds },
            }),
        ),
        setMessageCheckinMemberCheckinAt: Effect.fn(
          "MessageCheckinService.setMessageCheckinMemberCheckinAt",
        )((messageId: string, memberId: string, checkinAt: number) =>
          sheetApisClient.get().messageCheckin.setMessageCheckinMemberCheckinAt({
            payload: { messageId, memberId, checkinAt },
          }),
        ),
        removeMessageCheckinMember: Effect.fn("MessageCheckinService.removeMessageCheckinMember")(
          (messageId: string, memberId: string) =>
            sheetApisClient.get().messageCheckin.removeMessageCheckinMember({
              payload: { messageId, memberId },
            }),
        ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
