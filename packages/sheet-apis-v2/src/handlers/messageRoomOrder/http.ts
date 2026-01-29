import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { MessageRoomOrderService } from "@/services/messageRoomOrder";

export const MessageRoomOrderLive = HttpApiBuilder.group(Api, "messageRoomOrder", (handlers) =>
  pipe(
    Effect.all({
      messageRoomOrderService: MessageRoomOrderService,
    }),
    Effect.map(({ messageRoomOrderService }) =>
      handlers
        .handle("getMessageRoomOrder", ({ urlParams }) =>
          messageRoomOrderService.getMessageRoomOrder(urlParams.messageId),
        )
        .handle("upsertMessageRoomOrder", ({ payload }) =>
          messageRoomOrderService.upsertMessageRoomOrder(payload.messageId, {
            previousFills: payload.previousFills,
            fills: payload.fills,
            hour: payload.hour,
            rank: payload.rank,
            monitor: payload.monitor,
          }),
        )
        .handle("decrementMessageRoomOrderRank", ({ payload }) =>
          messageRoomOrderService.decrementMessageRoomOrderRank(payload.messageId),
        )
        .handle("incrementMessageRoomOrderRank", ({ payload }) =>
          messageRoomOrderService.incrementMessageRoomOrderRank(payload.messageId),
        )
        .handle("getMessageRoomOrderEntry", ({ urlParams }) =>
          messageRoomOrderService.getMessageRoomOrderEntry(
            urlParams.messageId,
            Number(urlParams.rank),
          ),
        )
        .handle("getMessageRoomOrderRange", ({ urlParams }) =>
          messageRoomOrderService.getMessageRoomOrderRange(urlParams.messageId),
        )
        .handle("upsertMessageRoomOrderEntry", ({ payload }) =>
          messageRoomOrderService.upsertMessageRoomOrderEntry(payload.messageId, payload.entries),
        )
        .handle("removeMessageRoomOrderEntry", ({ payload }) =>
          messageRoomOrderService.removeMessageRoomOrderEntry(payload.messageId),
        ),
    ),
  ),
).pipe(Layer.provide(MessageRoomOrderService.Default));
