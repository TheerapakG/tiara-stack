import { SheetApisClient } from "@/client/sheetApis";
import { Effect, pipe, Either, Scope } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import type { messageCheckin } from "sheet-db-schema";
import { Schema } from "sheet-apis";
import { DependencySignal } from "typhoon-core/signal";
import { Result, RpcResult } from "typhoon-core/schema";

type RpcSignal<Response> = Effect.Effect<
  DependencySignal.DependencySignal<
    RpcResult.RpcResult<Response, unknown>,
    never,
    never
  >,
  never,
  Scope.Scope
>;

type MessageCheckinDataResponse = Result.Result<
  Either.Either<Schema.MessageCheckin, Schema.Error.Core.ArgumentError>,
  Either.Either<Schema.MessageCheckin, Schema.Error.Core.ArgumentError>
>;

type MessageCheckinMembersResponse = Result.Result<
  ReadonlyArray<Schema.MessageCheckinMember>,
  ReadonlyArray<Schema.MessageCheckinMember>
>;

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
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
          getMessageCheckinData: (messageId: string) =>
            pipe(
              subscribe<MessageCheckinDataResponse>(
                "messageCheckin.getMessageCheckinData",
                messageId,
              ),
              Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
                captureStackTrace: true,
              }),
            ),
          upsertMessageCheckinData: (
            messageId: string,
            data: Omit<
              typeof messageCheckin.$inferInsert,
              "id" | "createdAt" | "updatedAt" | "deletedAt" | "messageId"
            >,
          ) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.upsertMessageCheckinData",
                { messageId, ...data },
              ),
              Effect.withSpan(
                "MessageCheckinService.upsertMessageCheckinData",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          getMessageCheckinMembers: (messageId: string) =>
            pipe(
              subscribe<MessageCheckinMembersResponse>(
                "messageCheckin.getMessageCheckinMembers",
                messageId,
              ),
              Effect.withSpan(
                "MessageCheckinService.getMessageCheckinMembers",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          addMessageCheckinMembers: (messageId: string, memberIds: string[]) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.addMessageCheckinMembers",
                { messageId, memberIds },
              ),
              Effect.withSpan(
                "MessageCheckinService.addMessageCheckinMembers",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          setMessageCheckinMemberCheckinAt: (
            messageId: string,
            memberId: string,
          ) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.setMessageCheckinMemberCheckinAt",
                { messageId, memberId },
              ),
              Effect.withSpan(
                "MessageCheckinService.setMessageCheckinMemberCheckinAt",
                { captureStackTrace: true },
              ),
            ),
          removeMessageCheckinMember: (messageId: string, memberId: string) =>
            pipe(
              WebSocketClient.mutate(
                client,
                "messageCheckin.removeMessageCheckinMember",
                { messageId, memberId },
              ),
              Effect.withSpan(
                "MessageCheckinService.removeMessageCheckinMember",
                { captureStackTrace: true },
              ),
            ),
        };
      }),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
