import { Array, Effect, Layer, Option, ServiceMap, pipe, Schema } from "effect";
import { mutators, queries } from "sheet-db-schema/zero";
import { catchSchemaErrorAsValidationError, makeDBQueryError } from "typhoon-core/error";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { ZeroService } from "./zero";
import { MessageCheckin, MessageCheckinMember } from "@/schemas/messageCheckin";

export class MessageCheckinService extends ServiceMap.Service<MessageCheckinService>()(
  "MessageCheckinService",
  {
    make: Effect.gen(function* () {
      const zeroService = yield* ZeroService;

      return {
        getMessageCheckinData: (messageId: string) =>
          pipe(
            zeroService.run(queries.messageCheckin.getMessageCheckinData({ messageId }), {
              type: "complete",
            }),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageCheckin))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageCheckinService.getMessageCheckinData"),
          ),
        upsertMessageCheckinData: (
          messageId: string,
          data: {
            initialMessage: string;
            hour: number;
            channelId: string;
            roleId?: string | null | undefined;
            guildId: string | null;
            messageChannelId: string | null;
            createdByUserId: string | null;
          },
        ) =>
          pipe(
            zeroService.mutate(
              mutators.messageCheckin.upsertMessageCheckinData({
                messageId,
                initialMessage: data.initialMessage,
                hour: data.hour,
                channelId: data.channelId,
                roleId: data.roleId,
                guildId: data.guildId,
                messageChannelId: data.messageChannelId,
                createdByUserId: data.createdByUserId,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageCheckin.getMessageCheckinData({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.OptionFromNullishOr(DefaultTaggedClass(MessageCheckin))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () =>
                  Effect.die(makeDBQueryError("Failed to upsert message check-in data")),
              }),
            ),
            Effect.withSpan("MessageCheckinService.upsertMessageCheckinData"),
          ),
        getMessageCheckinMembers: (messageId: string) =>
          pipe(
            zeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
              type: "complete",
            }),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageCheckinMember))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageCheckinService.getMessageCheckinMembers"),
          ),
        addMessageCheckinMembers: (messageId: string, memberIds: readonly string[]) =>
          pipe(
            zeroService.mutate(
              mutators.messageCheckin.addMessageCheckinMembers({ messageId, memberIds }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageCheckinMember))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.withSpan("MessageCheckinService.addMessageCheckinMembers"),
          ),
        setMessageCheckinMemberCheckinAt: (
          messageId: string,
          memberId: string,
          checkinAt: number,
        ) =>
          pipe(
            zeroService.mutate(
              mutators.messageCheckin.setMessageCheckinMemberCheckinAt({
                messageId,
                memberId,
                checkinAt,
              }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageCheckinMember))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.map(Array.findFirst((member) => member.memberId === memberId)),
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to set check-in timestamp")),
              }),
            ),
            Effect.withSpan("MessageCheckinService.setMessageCheckinMemberCheckinAt"),
          ),
        removeMessageCheckinMember: (messageId: string, memberId: string) =>
          pipe(
            zeroService.mutate(
              mutators.messageCheckin.removeMessageCheckinMember({ messageId, memberId }),
            ),
            Effect.andThen((mutation) => mutation.server()),
            Effect.andThen(
              zeroService.run(queries.messageCheckin.getMessageCheckinMembers({ messageId }), {
                type: "complete",
              }),
            ),
            Effect.flatMap(
              Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageCheckinMember))),
            ),
            catchSchemaErrorAsValidationError,
            Effect.map(Array.findFirst((member) => member.memberId === memberId)),
            Effect.flatMap(
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.die(makeDBQueryError("Failed to remove check-in member")),
              }),
            ),
            Effect.withSpan("MessageCheckinService.removeMessageCheckinMember"),
          ),
      };
    }),
  },
) {
  static layer = Layer.effect(MessageCheckinService, this.make).pipe(
    Layer.provide(ZeroService.layer),
  );
}
