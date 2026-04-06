import { Array, Effect, Layer, Option, ServiceMap, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { catchSchemaErrorAsValidationError, makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { ZeroService } from "./zero";
import {
  MessageRoomOrder,
  MessageRoomOrderEntry,
  MessageRoomOrderRange,
} from "@/schemas/messageRoomOrder";

export class MessageRoomOrderService extends ServiceMap.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    make: Effect.gen(function* () {
      const zeroService = yield* ZeroService;

      return {
        getMessageRoomOrder: (messageId: string) =>
          pipe(
            zeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
              type: "complete",
            }),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrder"),
          ),
        decrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            zeroService.mutate(
              mutators.messageRoomOrder.decrementMessageRoomOrderRank({ messageId }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to decrement room order rank")),
              }),
            ),
            Effect.withSpan("MessageRoomOrderService.decrementMessageRoomOrderRank"),
          ),
        incrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            zeroService.mutate(
              mutators.messageRoomOrder.incrementMessageRoomOrderRank({ messageId }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to increment room order rank")),
              }),
            ),
            Effect.withSpan("MessageRoomOrderService.incrementMessageRoomOrderRank"),
          ),
        upsertMessageRoomOrder: (
          messageId: string,
          data: {
            previousFills: readonly string[];
            fills: readonly string[];
            hour: number;
            rank: number;
            monitor?: string | null | undefined;
            guildId: string | null;
            messageChannelId: string | null;
            createdByUserId: string | null;
          },
        ) =>
          pipe(
            zeroService.mutate(
              mutators.messageRoomOrder.upsertMessageRoomOrder({
                messageId,
                previousFills: data.previousFills,
                fills: data.fills,
                hour: data.hour,
                rank: data.rank,
                monitor: data.monitor,
                guildId: data.guildId,
                messageChannelId: data.messageChannelId,
                createdByUserId: data.createdByUserId,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to upsert message room order")),
              }),
            ),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrder"),
          ),
        getMessageRoomOrderEntry: (messageId: string, rank: number) =>
          pipe(
            zeroService.run(
              queries.messageRoomOrder.getMessageRoomOrderEntry({ messageId, rank }),
              { type: "complete" },
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderEntry"),
          ),
        getMessageRoomOrderRange: (messageId: string) =>
          pipe(
            zeroService.run(queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }), {
              type: "complete",
            }),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry))),
            ),
            Effect.map((entries: readonly MessageRoomOrderEntry[]) =>
              pipe(
                entries,
                Array.match({
                  onEmpty: () => Option.none<MessageRoomOrderRange>(),
                  onNonEmpty: ([head, ...tail]) => {
                    const { minRank, maxRank } = pipe(
                      tail,
                      Array.reduce(
                        {
                          minRank: head.rank,
                          maxRank: head.rank,
                        },
                        (acc, entry) => ({
                          minRank: Math.min(acc.minRank, entry.rank),
                          maxRank: Math.max(acc.maxRank, entry.rank),
                        }),
                      ),
                    );
                    return Option.some(MessageRoomOrderRange.makeUnsafe({ minRank, maxRank }));
                  },
                }),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderRange"),
          ),
        upsertMessageRoomOrderEntry: (
          messageId: string,
          entries: readonly {
            rank: number;
            position: number;
            hour: number;
            team: string;
            tags: readonly string[];
            effectValue: number;
          }[],
        ) =>
          pipe(
            zeroService.mutate(
              mutators.messageRoomOrder.upsertMessageRoomOrderEntry({ messageId, entries }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry))),
            ),
            Effect.map((entries: readonly MessageRoomOrderEntry[]) =>
              pipe(
                entries,
                Array.map((entry) =>
                  MessageRoomOrderEntry.makeUnsafe({
                    messageId,
                    rank: entry.rank,
                    position: entry.position,
                    team: entry.team,
                    tags: entry.tags,
                    effectValue: entry.effectValue,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    deletedAt: entry.deletedAt,
                  }),
                ),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrderEntry"),
          ),
        removeMessageRoomOrderEntry: (messageId: string) =>
          pipe(
            zeroService.mutate(
              mutators.messageRoomOrder.removeMessageRoomOrderEntry({
                messageId,
                rank: 0,
                position: 0,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry))),
            ),
            Effect.map((entries: readonly MessageRoomOrderEntry[]) =>
              pipe(
                entries,
                Array.map((entry) =>
                  MessageRoomOrderEntry.makeUnsafe({
                    messageId,
                    rank: entry.rank,
                    position: entry.position,
                    team: entry.team,
                    tags: entry.tags,
                    effectValue: entry.effectValue,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    deletedAt: entry.deletedAt,
                  }),
                ),
              ),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.removeMessageRoomOrderEntry"),
          ),
      };
    }),
  },
) {
  static layer = Layer.effect(MessageRoomOrderService, this.make).pipe(
    Layer.provide(ZeroService.layer),
  );
}
