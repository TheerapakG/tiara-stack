import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe, Either, Scope } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageSlot } from "sheet-db-schema";
import { DependencySignal } from "typhoon-core/signal";
import { Result, RpcResult } from "typhoon-core/schema";
import { Schema } from "sheet-apis";

type RpcSignal<Response> = Effect.Effect<
  DependencySignal.DependencySignal<
    RpcResult.RpcResult<Response, unknown>,
    never,
    never
  >,
  never,
  Scope.Scope
>;

type MessageSlotDataResponse = Result.Result<
  Either.Either<Schema.MessageSlot, Schema.Error.Core.ArgumentError>,
  Either.Either<Schema.MessageSlot, Schema.Error.Core.ArgumentError>
>;

export class MessageSlotService extends Effect.Service<MessageSlotService>()(
  "MessageSlotService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("client", () => SheetApisClient.get()),
      Effect.map(({ client }) => {
        const subscribe = <Response>(
          handler: string,
          request: unknown,
        ): RpcSignal<Response> =>
          pipe(
            WebSocketClient.subscribeScoped(client, handler as any, request),
            Effect.orDie,
          ) as RpcSignal<Response>;

        return {
          getMessageSlotData: (messageId: string) =>
            pipe(
              subscribe<MessageSlotDataResponse>(
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
