import { HttpApiBuilder } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { MessageRoomOrderService } from "@/services/messageRoomOrder";
import { KubernetesTokenAuthorizationLive } from "@/middlewares/kubernetesTokenAuthorization/live";

export const MessageRoomOrderLive = HttpApiBuilder.group(Api, "messageRoomOrder", (handlers) =>
  pipe(
    Effect.all({
      messageRoomOrderService: MessageRoomOrderService,
    }),
    Effect.map(({ messageRoomOrderService }) =>
      handlers
        .handle("getMessageRoomOrder", ({ urlParams }) =>
          pipe(
            messageRoomOrderService.getMessageRoomOrder(urlParams.messageId),
            Effect.flatMap(
              Option.match({
                onSome: (order) => Effect.succeed(order),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      "Cannot get message room order, the message might not be registered",
                    ),
                  ),
              }),
            ),
          ),
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
          pipe(
            messageRoomOrderService.getMessageRoomOrderRange(urlParams.messageId),
            Effect.flatMap(
              Option.match({
                onSome: (range) => Effect.succeed(range),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      "Cannot get message room order range, the message might not be registered",
                    ),
                  ),
              }),
            ),
          ),
        )
        .handle("upsertMessageRoomOrderEntry", ({ payload }) =>
          messageRoomOrderService.upsertMessageRoomOrderEntry(payload.messageId, payload.entries),
        )
        .handle("removeMessageRoomOrderEntry", ({ payload }) =>
          messageRoomOrderService.removeMessageRoomOrderEntry(payload.messageId),
        ),
    ),
  ),
).pipe(
  Layer.provide(Layer.mergeAll(MessageRoomOrderService.Default, KubernetesTokenAuthorizationLive)),
);
