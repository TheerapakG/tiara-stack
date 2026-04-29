import { Effect, Layer, Option, Context, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { ZeroClient } from "./zeroClient";
import { MessageSlot } from "sheet-ingress-api/schemas/messageSlot";

export class MessageSlotService extends Context.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    make: Effect.gen(function* () {
      const zeroClient = yield* ZeroClient;

      const getMessageSlotData = Effect.fn("MessageSlotService.getMessageSlotData")(function* (
        messageId: string,
      ) {
        const result = yield* zeroClient.run(
          queries.messageSlot.getMessageSlotData({ messageId }),
          {
            type: "complete",
          },
        );

        return yield* Schema.decodeEffect(
          Schema.OptionFromNullishOr(DefaultTaggedClass(MessageSlot)),
        )(result);
      });

      const upsertMessageSlotData = Effect.fn("MessageSlotService.upsertMessageSlotData")(
        function* (
          messageId: string,
          data: {
            day: number;
            guildId: string | null;
            messageChannelId: string | null;
            createdByUserId: string | null;
          },
        ) {
          const mutation = yield* zeroClient.mutate(
            mutators.messageSlot.upsertMessageSlotData({
              messageId,
              day: data.day,
              guildId: data.guildId,
              messageChannelId: data.messageChannelId,
              createdByUserId: data.createdByUserId,
            }),
          );
          yield* mutation.server();

          const result = yield* zeroClient.run(
            queries.messageSlot.getMessageSlotData({ messageId }),
            {
              type: "complete",
            },
          );
          const messageSlot = yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(MessageSlot)),
          )(result);

          if (Option.isNone(messageSlot)) {
            return yield* Effect.die(makeDBQueryError("Failed to upsert message slot data"));
          }

          return messageSlot.value;
        },
      );

      return {
        getMessageSlotData,
        upsertMessageSlotData,
      };
    }),
  },
) {
  static layer = Layer.effect(MessageSlotService, this.make).pipe(Layer.provide(ZeroClient.layer));
}
