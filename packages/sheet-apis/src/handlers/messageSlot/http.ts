import { HttpApiBuilder } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
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
          pipe(
            messageSlotService.getMessageSlotData(urlParams.messageId),
            Effect.flatMap(
              Option.match({
                onSome: (data) => Effect.succeed(data),
                onNone: () =>
                  Effect.fail(
                    makeArgumentError(
                      "Cannot get message slot data, the message might not be registered",
                    ),
                  ),
              }),
            ),
          ),
        )
        .handle("upsertMessageSlotData", ({ payload }) =>
          messageSlotService.upsertMessageSlotData(payload.messageId, payload.day),
        ),
    ),
  ),
).pipe(Layer.provide(MessageSlotService.Default));
