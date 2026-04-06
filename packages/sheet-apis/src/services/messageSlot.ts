import { Effect, Layer, Option, ServiceMap, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { catchSchemaErrorAsValidationError, makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { ZeroService } from "./zero";
import { MessageSlot } from "@/schemas/messageSlot";

export class MessageSlotService extends ServiceMap.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    make: Effect.gen(function* () {
      const zeroService = yield* ZeroService;

      return {
        getMessageSlotData: (messageId: string) =>
          pipe(
            zeroService.run(queries.messageSlot.getMessageSlotData({ messageId }), {
              type: "complete",
            }),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageSlot))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageSlotService.getMessageSlotData"),
          ),
        upsertMessageSlotData: (
          messageId: string,
          data: {
            day: number;
            guildId: string | null;
            messageChannelId: string | null;
            createdByUserId: string | null;
          },
        ) =>
          pipe(
            zeroService.mutate(
              mutators.messageSlot.upsertMessageSlotData({
                messageId,
                day: data.day,
                guildId: data.guildId,
                messageChannelId: data.messageChannelId,
                createdByUserId: data.createdByUserId,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageSlot.getMessageSlotData({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageSlot))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to upsert message slot data")),
              }),
            ),
            Effect.withSpan("MessageSlotService.upsertMessageSlotData"),
          ),
      };
    }),
  },
) {
  static layer = Layer.effect(MessageSlotService, this.make).pipe(Layer.provide(ZeroService.layer));
}
