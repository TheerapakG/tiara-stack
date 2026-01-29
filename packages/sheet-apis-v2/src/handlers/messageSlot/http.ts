import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { MessageSlotService } from "@/services/messageSlot";

export const MessageSlotLive = HttpApiBuilder.group(Api, "messageSlot", (handlers) =>
  pipe(
    Effect.all({
      messageSlotService: MessageSlotService,
    }),
    Effect.map(({ messageSlotService }) =>
      handlers
        .handle("getMessageSlotData", ({ urlParams }) =>
          messageSlotService.getMessageSlotData(urlParams.messageId),
        )
        .handle("upsertMessageSlotData", ({ payload }) =>
          messageSlotService.upsertMessageSlotData(payload.messageId, payload.day),
        ),
    ),
  ),
).pipe(Layer.provide(MessageSlotService.Default));
