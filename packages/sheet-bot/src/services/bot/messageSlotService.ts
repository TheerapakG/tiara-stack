import { SheetApisClient } from "@/client/sheetApis";
import { Effect, Either, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageSlot } from "sheet-db-schema";
import { Result } from "typhoon-core/schema";
import { UntilObserver } from "typhoon-core/signal";

export class MessageSlotService extends Effect.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => {
        const waitForComplete = <Req, A>(
          name: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            WebSocketClient.subscribeScoped(client, name as any, request),
            UntilObserver.observeUntilScoped(Result.isComplete),
            Effect.map((result) => result.value as A),
          );

        const fetchEither = <Req, A>(
          name: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            waitForComplete<Req, Either.Either<A, unknown>>(name, request),
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
              fetchEither("messageSlot.getMessageSlotData", messageId),
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
