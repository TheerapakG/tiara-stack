import { Effect, Layer, ServiceMap } from "effect";
import { SheetApisClient } from "./sheetApis";

export class MessageCheckinService extends ServiceMap.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    make: Effect.gen(function* () {
      const sheetApisClient = yield* SheetApisClient;

      return {
        getMessageCheckinData: Effect.fn("MessageCheckinService.getMessageCheckinData")(function* (
          messageId: string,
        ) {
          return yield* sheetApisClient.get().messageCheckin.getMessageCheckinData({
            query: { messageId },
          });
        }),
        upsertMessageCheckinData: Effect.fn("MessageCheckinService.upsertMessageCheckinData")(
          function* (
            messageId: string,
            data: {
              initialMessage: string;
              hour: number;
              channelId: string;
              roleId: string | null | undefined;
              guildId: string | null;
              messageChannelId: string | null;
              createdByUserId: string | null;
            },
          ) {
            return yield* sheetApisClient.get().messageCheckin.upsertMessageCheckinData({
              payload: { messageId, data },
            });
          },
        ),
        getMessageCheckinMembers: Effect.fn("MessageCheckinService.getMessageCheckinMembers")(
          function* (messageId: string) {
            return yield* sheetApisClient.get().messageCheckin.getMessageCheckinMembers({
              query: { messageId },
            });
          },
        ),
        addMessageCheckinMembers: Effect.fn("MessageCheckinService.addMessageCheckinMembers")(
          function* (messageId: string, memberIds: ReadonlyArray<string>) {
            return yield* sheetApisClient.get().messageCheckin.addMessageCheckinMembers({
              payload: { messageId, memberIds },
            });
          },
        ),
        setMessageCheckinMemberCheckinAt: Effect.fn(
          "MessageCheckinService.setMessageCheckinMemberCheckinAt",
        )(function* (messageId: string, memberId: string, checkinAt: number) {
          return yield* sheetApisClient.get().messageCheckin.setMessageCheckinMemberCheckinAt({
            payload: { messageId, memberId, checkinAt },
          });
        }),
        removeMessageCheckinMember: Effect.fn("MessageCheckinService.removeMessageCheckinMember")(
          function* (messageId: string, memberId: string) {
            return yield* sheetApisClient.get().messageCheckin.removeMessageCheckinMember({
              payload: { messageId, memberId },
            });
          },
        ),
      };
    }),
  },
) {
  static layer = Layer.effect(MessageCheckinService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
  );
}
