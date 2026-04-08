import { Array, Effect, Layer, Option, ServiceMap, Schema } from "effect";
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

      const getMessageCheckinData = Effect.fn("MessageCheckinService.getMessageCheckinData")(
        function* (messageId: string) {
          const result = yield* zeroService.run(
            queries.messageCheckin.getMessageCheckinData({ messageId }),
            {
              type: "complete",
            },
          );

          return yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(MessageCheckin)),
          )(result);
        },
        (effect) => effect.pipe(catchSchemaErrorAsValidationError),
        (effect) => effect.pipe(Effect.withSpan("MessageCheckinService.getMessageCheckinData")),
      );

      const upsertMessageCheckinData = Effect.fn("MessageCheckinService.upsertMessageCheckinData")(
        function* (
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
        ) {
          const mutation = yield* zeroService.mutate(
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
          );
          yield* mutation.server();

          const result = yield* zeroService.run(
            queries.messageCheckin.getMessageCheckinData({ messageId }),
            {
              type: "complete",
            },
          );
          const messageCheckin = yield* Schema.decodeEffect(
            Schema.OptionFromNullishOr(DefaultTaggedClass(MessageCheckin)),
          )(result).pipe(catchSchemaErrorAsValidationError);

          if (Option.isNone(messageCheckin)) {
            return yield* Effect.die(makeDBQueryError("Failed to upsert message check-in data"));
          }

          return messageCheckin.value;
        },
        (effect) => effect.pipe(Effect.withSpan("MessageCheckinService.upsertMessageCheckinData")),
      );

      const getMessageCheckinMembers = Effect.fn("MessageCheckinService.getMessageCheckinMembers")(
        function* (messageId: string) {
          const result = yield* zeroService.run(
            queries.messageCheckin.getMessageCheckinMembers({ messageId }),
            {
              type: "complete",
            },
          );

          return yield* Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageCheckinMember)))(
            result,
          );
        },
        (effect) => effect.pipe(catchSchemaErrorAsValidationError),
        (effect) => effect.pipe(Effect.withSpan("MessageCheckinService.getMessageCheckinMembers")),
      );

      const addMessageCheckinMembers = Effect.fn("MessageCheckinService.addMessageCheckinMembers")(
        function* (messageId: string, memberIds: readonly string[]) {
          const mutation = yield* zeroService.mutate(
            mutators.messageCheckin.addMessageCheckinMembers({ messageId, memberIds }),
          );
          yield* mutation.server();

          const result = yield* zeroService.run(
            queries.messageCheckin.getMessageCheckinMembers({ messageId }),
            {
              type: "complete",
            },
          );

          return yield* Schema.decodeEffect(Schema.Array(DefaultTaggedClass(MessageCheckinMember)))(
            result,
          ).pipe(catchSchemaErrorAsValidationError);
        },
        (effect) => effect.pipe(Effect.withSpan("MessageCheckinService.addMessageCheckinMembers")),
      );

      const setMessageCheckinMemberCheckinAt = Effect.fn(
        "MessageCheckinService.setMessageCheckinMemberCheckinAt",
      )(
        function* (messageId: string, memberId: string, checkinAt: number) {
          const mutation = yield* zeroService.mutate(
            mutators.messageCheckin.setMessageCheckinMemberCheckinAt({
              messageId,
              memberId,
              checkinAt,
            }),
          );
          yield* mutation.server();

          const result = yield* zeroService.run(
            queries.messageCheckin.getMessageCheckinMembers({ messageId }),
            {
              type: "complete",
            },
          );
          const members = yield* Schema.decodeEffect(
            Schema.Array(DefaultTaggedClass(MessageCheckinMember)),
          )(result).pipe(catchSchemaErrorAsValidationError);
          const member = Array.findFirst(members, (item) => item.memberId === memberId);

          if (Option.isNone(member)) {
            return yield* Effect.die(makeDBQueryError("Failed to set check-in timestamp"));
          }

          return member.value;
        },
        (effect) =>
          effect.pipe(Effect.withSpan("MessageCheckinService.setMessageCheckinMemberCheckinAt")),
      );

      const removeMessageCheckinMember = Effect.fn(
        "MessageCheckinService.removeMessageCheckinMember",
      )(
        function* (messageId: string, memberId: string) {
          const mutation = yield* zeroService.mutate(
            mutators.messageCheckin.removeMessageCheckinMember({ messageId, memberId }),
          );
          yield* mutation.server();

          const result = yield* zeroService.run(
            queries.messageCheckin.getMessageCheckinMembers({ messageId }),
            {
              type: "complete",
            },
          );
          const members = yield* Schema.decodeEffect(
            Schema.Array(DefaultTaggedClass(MessageCheckinMember)),
          )(result).pipe(catchSchemaErrorAsValidationError);
          const member = Array.findFirst(members, (item) => item.memberId === memberId);

          if (Option.isNone(member)) {
            return yield* Effect.die(makeDBQueryError("Failed to remove check-in member"));
          }

          return member.value;
        },
        (effect) =>
          effect.pipe(Effect.withSpan("MessageCheckinService.removeMessageCheckinMember")),
      );

      return {
        getMessageCheckinData,
        upsertMessageCheckinData,
        getMessageCheckinMembers,
        addMessageCheckinMembers,
        setMessageCheckinMemberCheckinAt,
        removeMessageCheckinMember,
      };
    }),
  },
) {
  static layer = Layer.effect(MessageCheckinService, this.make).pipe(
    Layer.provide(ZeroService.layer),
  );
}
