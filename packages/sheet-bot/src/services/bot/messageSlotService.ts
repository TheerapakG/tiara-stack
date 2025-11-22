import { SheetApisClient } from "@/client/sheetApis";
import { Effect, Either, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageSlot } from "sheet-db-schema";
import { Schema } from "sheet-apis";
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
            WebSocketClient.once(
              client,
              handler as any,
              request,
            ) as Effect.Effect<Result.Result<A>, never, never>,
            Effect.orDie,
            Effect.flatMap((result) =>
              Result.match({
                onOptimistic: Effect.succeed,
                onComplete: Effect.succeed,
              })(result),
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
                onLeft: Effect.die,
                onRight: Effect.succeed,
              }),
            ),
          );

        return {
          getMessageSlotData: (messageId: string) =>
            pipe(
              decodeEither<string, Schema.MessageSlot>(
                "messageSlot.getMessageSlotData",
                messageId,
              ),
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
