import { Array, Effect, Layer, Option, Context, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { ZeroService } from "./zero";
import {
  MessageRoomOrder,
  MessageRoomOrderEntry,
  MessageRoomOrderRange,
} from "@/schemas/messageRoomOrder";

export class MessageRoomOrderService extends Context.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    make: Effect.gen(function* () {
      const zeroService = yield* ZeroService;

      const getMessageRoomOrder = Effect.fn("MessageRoomOrderService.getMessageRoomOrder")(
        function* (messageId: string) {
          const result = yield* zeroService.run(
            queries.messageRoomOrder.getMessageRoomOrder({ messageId }),
            {
              type: "complete",
            },
          );

          return yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder)),
          )(result);
        },
      );

      const decrementMessageRoomOrderRank = Effect.fn(
        "MessageRoomOrderService.decrementMessageRoomOrderRank",
      )(function* (messageId: string) {
        const mutation = yield* zeroService.mutate(
          mutators.messageRoomOrder.decrementMessageRoomOrderRank({ messageId }),
        );
        yield* mutation.server();

        const result = yield* zeroService.run(
          queries.messageRoomOrder.getMessageRoomOrder({ messageId }),
          {
            type: "complete",
          },
        );
        const roomOrder = yield* Schema.decodeEffect(
          Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder)),
        )(result);

        if (Option.isNone(roomOrder)) {
          return yield* Effect.die(makeDBQueryError("Failed to decrement room order rank"));
        }

        return roomOrder.value;
      });

      const incrementMessageRoomOrderRank = Effect.fn(
        "MessageRoomOrderService.incrementMessageRoomOrderRank",
      )(function* (messageId: string) {
        const mutation = yield* zeroService.mutate(
          mutators.messageRoomOrder.incrementMessageRoomOrderRank({ messageId }),
        );
        yield* mutation.server();

        const result = yield* zeroService.run(
          queries.messageRoomOrder.getMessageRoomOrder({ messageId }),
          {
            type: "complete",
          },
        );
        const roomOrder = yield* Schema.decodeEffect(
          Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder)),
        )(result);

        if (Option.isNone(roomOrder)) {
          return yield* Effect.die(makeDBQueryError("Failed to increment room order rank"));
        }

        return roomOrder.value;
      });

      const upsertMessageRoomOrder = Effect.fn("MessageRoomOrderService.upsertMessageRoomOrder")(
        function* (
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
        ) {
          const mutation = yield* zeroService.mutate(
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
          );
          yield* mutation.server();

          const result = yield* zeroService.run(
            queries.messageRoomOrder.getMessageRoomOrder({ messageId }),
            {
              type: "complete",
            },
          );
          const roomOrder = yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder)),
          )(result);

          if (Option.isNone(roomOrder)) {
            return yield* Effect.die(makeDBQueryError("Failed to upsert message room order"));
          }

          return roomOrder.value;
        },
      );

      const persistMessageRoomOrder = Effect.fn("MessageRoomOrderService.persistMessageRoomOrder")(
        function* (
          messageId: string,
          payload: {
            data: {
              previousFills: readonly string[];
              fills: readonly string[];
              hour: number;
              rank: number;
              monitor?: string | null | undefined;
              guildId: string | null;
              messageChannelId: string | null;
              createdByUserId: string | null;
            };
            entries: readonly {
              rank: number;
              position: number;
              hour: number;
              team: string;
              tags: readonly string[];
              effectValue: number;
            }[];
          },
        ) {
          const mutation = yield* zeroService.mutate(
            mutators.messageRoomOrder.persistMessageRoomOrder({
              messageId,
              data: payload.data,
              entries: payload.entries,
            }),
          );
          yield* mutation.server();

          const result = yield* zeroService.run(
            queries.messageRoomOrder.getMessageRoomOrder({ messageId }),
            {
              type: "complete",
            },
          );
          const roomOrder = yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder)),
          )(result);

          if (Option.isNone(roomOrder)) {
            return yield* Effect.die(makeDBQueryError("Failed to persist message room order"));
          }

          return roomOrder.value;
        },
      );

      const getMessageRoomOrderEntry = Effect.fn(
        "MessageRoomOrderService.getMessageRoomOrderEntry",
      )(function* (messageId: string, rank: number) {
        const result = yield* zeroService.run(
          queries.messageRoomOrder.getMessageRoomOrderEntry({ messageId, rank }),
          { type: "complete" },
        );

        return yield* Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)))(
          result,
        );
      });

      const getMessageRoomOrderRange = Effect.fn(
        "MessageRoomOrderService.getMessageRoomOrderRange",
      )(function* (messageId: string) {
        const result = yield* zeroService.run(
          queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }),
          { type: "complete" },
        );
        const entries = yield* Schema.decodeEffect(
          Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
        )(result);

        return Array.match(entries, {
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
            return Option.some(new MessageRoomOrderRange({ minRank, maxRank }));
          },
        });
      });

      const upsertMessageRoomOrderEntry = Effect.fn(
        "MessageRoomOrderService.upsertMessageRoomOrderEntry",
      )(function* (
        messageId: string,
        entries: readonly {
          rank: number;
          position: number;
          hour: number;
          team: string;
          tags: readonly string[];
          effectValue: number;
        }[],
      ) {
        const mutation = yield* zeroService.mutate(
          mutators.messageRoomOrder.upsertMessageRoomOrderEntry({ messageId, entries }),
        );
        yield* mutation.server();

        const result = yield* zeroService.run(
          queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }),
          { type: "complete" },
        );
        const updatedEntries = yield* Schema.decodeEffect(
          Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
        )(result);

        return updatedEntries.map(
          (entry) =>
            new MessageRoomOrderEntry({
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
        );
      });

      const removeMessageRoomOrderEntry = Effect.fn(
        "MessageRoomOrderService.removeMessageRoomOrderEntry",
      )(function* (messageId: string) {
        const mutation = yield* zeroService.mutate(
          mutators.messageRoomOrder.removeMessageRoomOrderEntry({
            messageId,
            rank: 0,
            position: 0,
          }),
        );
        yield* mutation.server();

        const result = yield* zeroService.run(
          queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }),
          { type: "complete" },
        );
        const updatedEntries = yield* Schema.decodeEffect(
          Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)),
        )(result);

        return updatedEntries.map(
          (entry) =>
            new MessageRoomOrderEntry({
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
        );
      });

      return {
        getMessageRoomOrder,
        decrementMessageRoomOrderRank,
        incrementMessageRoomOrderRank,
        upsertMessageRoomOrder,
        persistMessageRoomOrder,
        getMessageRoomOrderEntry,
        getMessageRoomOrderRange,
        upsertMessageRoomOrderEntry,
        removeMessageRoomOrderEntry,
      };
    }),
  },
) {
  static layer = Layer.effect(MessageRoomOrderService, this.make).pipe(
    Layer.provide(ZeroService.layer),
  );
}
