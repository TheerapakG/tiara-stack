import { Context, Effect, Option, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { catchParseErrorAsValidationError } from "typhoon-core/error";
import { ZeroService } from "typhoon-core/services";
import { ZeroLive } from "./zero";
import { type Schema as ZeroSchema } from "sheet-db-schema/zero";
import { MessageSlot } from "@/schemas/messageSlot";

export class MessageSlotService extends Effect.Service<MessageSlotService>()("MessageSlotService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("zeroContext", () =>
      pipe(
        Effect.context<ZeroService.ZeroService<ZeroSchema, any, any>>(),
        Effect.map(Context.pick(ZeroService.ZeroService<ZeroSchema, any, any>())),
      ),
    ),
    Effect.map(({ zeroContext }) => ({
      getMessageSlotData: (messageId: string) =>
        pipe(
          ZeroService.run(queries.messageSlot.getMessageSlotData({ messageId }), {
            type: "complete",
          }),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageSlot), undefined)),
          ),
          catchParseErrorAsValidationError,
          Effect.withSpan("MessageSlotService.getMessageSlotData", {
            captureStackTrace: true,
          }),
        ),
      upsertMessageSlotData: (messageId: string, day: number) =>
        pipe(
          ZeroService.mutate(mutators.messageSlot.upsertMessageSlotData({ messageId, day })),
          Effect.andThen((mutation) => mutation.server()),
          Effect.andThen(
            ZeroService.run(queries.messageSlot.getMessageSlotData({ messageId }), {
              type: "complete",
            }),
          ),
          Effect.provide(zeroContext),
          Effect.flatMap(
            Schema.decode(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageSlot), undefined)),
          ),
          catchParseErrorAsValidationError,
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(makeDBQueryError("Failed to upsert message slot data")),
            }),
          ),
          Effect.withSpan("MessageSlotService.upsertMessageSlotData", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [ZeroLive],
  accessors: true,
}) {}
