import { SheetApisClient } from "@/client/sheetApis";
import { Effect, Either, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageSlot } from "sheet-db-schema";
import { Result } from "typhoon-core/schema";

export class MessageSlotService extends Effect.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => {
        const decodeResult = <Req, A>(
          handler: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            WebSocketClient.once(client, handler as any, request),
            Effect.orDie,
            Effect.flatMap((result) =>
              Result.match(result, {
                onOptimistic: Effect.succeed,
                onComplete: Effect.succeed,
              }),
            ),
          );

        const decodeEither = <Req, A>(
          handler: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            decodeResult<Req, Either.Either<A, unknown>>(handler, request),
            Effect.flatMap(
              Either.match({
                onLeft: Effect.fail,
                onRight: Effect.succeed,
              }),
            ),
          );

        return {
          getMessageSlotData: (messageId: string) =>
            pipe(
              decodeEither("messageSlot.getMessageSlotData", messageId),
              Effect.withSpan("MessageSlotService.getMessageSlotData", {
                captureStackTrace: true,
              }),
            ),
          upsertMessageSlotData: (
            messageId: string,
            data: Omit<
              typeof messageSlot.$inferInsert,
              "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
            >,
          ) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageSlot.upsertMessageSlotData",
                { messageId, ...data },
              ),
              Effect.withSpan("MessageSlotService.upsertMessageSlotData", {
                captureStackTrace: true,
              }),
            ),
        };
      }),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
