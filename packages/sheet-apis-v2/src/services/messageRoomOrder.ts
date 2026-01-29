import { Array, Context, Effect, Option, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { catchParseErrorAsValidationError } from "typhoon-core/error";
import { ZeroService } from "typhoon-core/services";
import { ZeroLive } from "./zero";
import { type Schema as ZeroSchema } from "sheet-db-schema/zero";
import {
  MessageRoomOrder,
  MessageRoomOrderEntry,
  MessageRoomOrderRange,
} from "@/schemas/messageRoomOrder";

export class MessageRoomOrderService extends Effect.Service<MessageRoomOrderService>()(
  "MessageRoomOrderService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("zeroContext", () =>
        pipe(
          Effect.context<ZeroService.ZeroService<ZeroSchema, any, any>>(),
          Effect.map(Context.pick(ZeroService.ZeroService<ZeroSchema, any, any>())),
        ),
      ),
      Effect.map(({ zeroContext }) => ({
        getMessageRoomOrder: (messageId: string) =>
          pipe(
            ZeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
              type: "complete",
            }),
            Effect.provide(zeroContext),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder), undefined),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        decrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            ZeroService.mutate(
              mutators.messageRoomOrder.decrementMessageRoomOrderRank({ messageId }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              ZeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder), undefined),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to decrement room order rank")),
              }),
            ),
            Effect.withSpan("MessageRoomOrderService.decrementMessageRoomOrderRank", {
              captureStackTrace: true,
            }),
          ),
        incrementMessageRoomOrderRank: (messageId: string) =>
          pipe(
            ZeroService.mutate(
              mutators.messageRoomOrder.incrementMessageRoomOrderRank({ messageId }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              ZeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder), undefined),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to increment room order rank")),
              }),
            ),
            Effect.withSpan("MessageRoomOrderService.incrementMessageRoomOrderRank", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageRoomOrder: (
          messageId: string,
          data: {
            previousFills: readonly string[];
            fills: readonly string[];
            hour: number;
            rank: number;
            monitor?: string | null | undefined;
          },
        ) =>
          pipe(
            ZeroService.mutate(
              mutators.messageRoomOrder.upsertMessageRoomOrder({
                messageId,
                previousFills: data.previousFills,
                fills: data.fills,
                hour: data.hour,
                rank: data.rank,
                monitor: data.monitor,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              ZeroService.run(queries.messageRoomOrder.getMessageRoomOrder({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromNullishOr(DefaultTaggedClass(MessageRoomOrder), undefined),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to upsert message room order")),
              }),
            ),
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrder", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderEntry: (messageId: string, rank: number) =>
          pipe(
            ZeroService.run(
              queries.messageRoomOrder.getMessageRoomOrderEntry({ messageId, rank }),
              { type: "complete" },
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)))),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
          ),
        getMessageRoomOrderRange: (messageId: string) =>
          pipe(
            ZeroService.run(queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }), {
              type: "complete",
            }),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)))),
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
                    return Option.some(new MessageRoomOrderRange({ minRank, maxRank }));
                  },
                }),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.getMessageRoomOrderRange", {
              captureStackTrace: true,
            }),
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
            ZeroService.mutate(
              mutators.messageRoomOrder.upsertMessageRoomOrderEntry({ messageId, entries }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              ZeroService.run(queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)))),
            Effect.map((entries: readonly MessageRoomOrderEntry[]) =>
              pipe(
                entries,
                Array.map(
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
                ),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.upsertMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
          ),
        removeMessageRoomOrderEntry: (messageId: string) =>
          pipe(
            ZeroService.mutate(
              mutators.messageRoomOrder.removeMessageRoomOrderEntry({
                messageId,
                rank: 0,
                position: 0,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              ZeroService.run(queries.messageRoomOrder.getMessageRoomOrderRange({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageRoomOrderEntry)))),
            Effect.map((entries: readonly MessageRoomOrderEntry[]) =>
              pipe(
                entries,
                Array.map(
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
                ),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageRoomOrderService.removeMessageRoomOrderEntry", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [ZeroLive],
    accessors: true,
  },
) {}
