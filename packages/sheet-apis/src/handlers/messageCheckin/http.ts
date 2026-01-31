import { HttpApiBuilder } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { MessageCheckinService } from "@/services/messageCheckin";

export const MessageCheckinLive = HttpApiBuilder.group(Api, "messageCheckin", (handlers) =>
  pipe(
    Effect.all({
      messageCheckinService: MessageCheckinService,
    }),
    Effect.map(({ messageCheckinService }) =>
      handlers
        .handle("getMessageCheckinData", ({ urlParams }) =>
          pipe(
            messageCheckinService.getMessageCheckinData(urlParams.messageId),
            Effect.flatMap(
              Option.match({
                onSome: (data) => Effect.succeed(data),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      "Cannot get message checkin data, the message might not be registered",
                    ),
                  ),
              }),
            ),
          ),
        )
        .handle("upsertMessageCheckinData", ({ payload }) =>
          messageCheckinService.upsertMessageCheckinData(payload.messageId, {
            initialMessage: payload.initialMessage,
            hour: payload.hour,
            channelId: payload.channelId,
            roleId: payload.roleId,
          }),
        )
        .handle("getMessageCheckinMembers", ({ urlParams }) =>
          messageCheckinService.getMessageCheckinMembers(urlParams.messageId),
        )
        .handle("addMessageCheckinMembers", ({ payload }) =>
          messageCheckinService.addMessageCheckinMembers(payload.messageId, payload.memberIds),
        )
        .handle("setMessageCheckinMemberCheckinAt", ({ payload }) =>
          messageCheckinService.setMessageCheckinMemberCheckinAt(
            payload.messageId,
            payload.memberId,
            payload.checkinAt,
          ),
        )
        .handle("removeMessageCheckinMember", ({ payload }) =>
          messageCheckinService.removeMessageCheckinMember(payload.messageId, payload.memberId),
        ),
    ),
  ),
).pipe(Layer.provide(MessageCheckinService.Default));
