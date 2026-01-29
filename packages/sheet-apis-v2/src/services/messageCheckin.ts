import { Array, Context, Effect, Option, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { catchParseErrorAsValidationError } from "typhoon-core/error";
import { ZeroService } from "typhoon-core/services";
import { ZeroLive } from "./zero";
import { type Schema as ZeroSchema } from "sheet-db-schema/zero";
import { MessageCheckin, MessageCheckinMember } from "@/schemas/messageCheckin";

export class MessageCheckinService extends Effect.Service<MessageCheckinService>()(
  "MessageCheckinService",
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
        getMessageCheckinData: (messageId: string) =>
          pipe(
            ZeroService.run(queries.messageCheckin.getMessageCheckinData({ messageId }), {
              type: "complete",
            }),
            Effect.provide(zeroContext),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromNullishOr(DefaultTaggedClass(MessageCheckin), undefined),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageCheckinService.getMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        upsertMessageCheckinData: (
          messageId: string,
          data: {
            initialMessage: string;
            hour: number;
            channelId: string;
            roleId?: string | null | undefined;
          },
        ) =>
          pipe(
            ZeroService.mutate(
              mutators.messageCheckin.upsertMessageCheckinData({
                messageId,
                initialMessage: data.initialMessage,
                hour: data.hour,
                channelId: data.channelId,
                roleId: data.roleId,
              }),
            ),
            Effect.andThen(
              ZeroService.run(queries.messageCheckin.getMessageCheckinData({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(
              Schema.decode(
                Schema.OptionFromNullishOr(DefaultTaggedClass(MessageCheckin), undefined),
              ),
            ),
            catchParseErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () =>
                  Effect.die(makeDBQueryError("Failed to upsert message check-in data")),
              }),
            ),
            Effect.withSpan("MessageCheckinService.upsertMessageCheckinData", {
              captureStackTrace: true,
            }),
          ),
        getMessageCheckinMembers: (messageId: string) =>
          pipe(
            ZeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
              type: "complete",
            }),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageCheckinMember)))),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageCheckinService.getMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        addMessageCheckinMembers: (messageId: string, memberIds: readonly string[]) =>
          pipe(
            ZeroService.mutate(
              mutators.messageCheckin.addMessageCheckinMembers({ messageId, memberIds }),
            ),
            Effect.andThen(
              ZeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageCheckinMember)))),
            catchParseErrorAsValidationError,
            Effect.withSpan("MessageCheckinService.addMessageCheckinMembers", {
              captureStackTrace: true,
            }),
          ),
        setMessageCheckinMemberCheckinAt: (
          messageId: string,
          memberId: string,
          checkinAt: number,
        ) =>
          pipe(
            ZeroService.mutate(
              mutators.messageCheckin.setMessageCheckinMemberCheckinAt({
                messageId,
                memberId,
                checkinAt,
              }),
            ),
            Effect.andThen(
              ZeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageCheckinMember)))),
            catchParseErrorAsValidationError,
            Effect.map(Array.findFirst((member) => member.memberId === memberId)),
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to set check-in timestamp")),
              }),
            ),
            Effect.withSpan("MessageCheckinService.setMessageCheckinMemberCheckinAt", {
              captureStackTrace: true,
            }),
          ),
        removeMessageCheckinMember: (messageId: string, memberId: string) =>
          pipe(
            ZeroService.mutate(
              mutators.messageCheckin.removeMessageCheckinMember({ messageId, memberId }),
            ),
            Effect.andThen(
              ZeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.provide(zeroContext),
            Effect.flatMap(Schema.decode(Schema.Array(DefaultTaggedClass(MessageCheckinMember)))),
            catchParseErrorAsValidationError,
            Effect.map(Array.findFirst((member) => member.memberId === memberId)),
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to remove check-in member")),
              }),
            ),
            Effect.withSpan("MessageCheckinService.removeMessageCheckinMember", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [ZeroLive],
    accessors: true,
  },
) {}
