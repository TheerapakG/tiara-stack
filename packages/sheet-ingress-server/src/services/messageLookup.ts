import { Cache, Context, Duration, Effect, Exit, Layer, Option } from "effect";
import { MessageCheckin, MessageCheckinMember } from "sheet-ingress-api/schemas/messageCheckin";
import { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import { MessageSlot } from "sheet-ingress-api/schemas/messageSlot";
import { SheetApisClient } from "./sheetApisClient";

export class MessageLookup extends Context.Service<MessageLookup>()("MessageLookup", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;
    const cacheOptions = {
      capacity: 1_000,
      timeToLive: Exit.match({
        onFailure: () => Duration.seconds(1),
        onSuccess: () => Duration.seconds(5),
      }),
    };

    const messageCheckinDataCache = yield* Cache.makeWith<
      string,
      Option.Option<MessageCheckin>,
      unknown
    >(
      (messageId) =>
        sheetApisClient.withServiceUser(
          sheetApisClient.messageCheckin
            .getMessageCheckinData({ query: { messageId } })
            .pipe(Effect.option),
        ),
      cacheOptions,
    );
    const messageCheckinMembersCache = yield* Cache.makeWith<
      string,
      ReadonlyArray<MessageCheckinMember>,
      unknown
    >(
      (messageId) =>
        sheetApisClient.withServiceUser(
          sheetApisClient.messageCheckin.getMessageCheckinMembers({ query: { messageId } }),
        ),
      cacheOptions,
    );
    const messageRoomOrderCache = yield* Cache.makeWith<
      string,
      Option.Option<MessageRoomOrder>,
      unknown
    >(
      (messageId) =>
        sheetApisClient.withServiceUser(
          sheetApisClient.messageRoomOrder
            .getMessageRoomOrder({ query: { messageId } })
            .pipe(Effect.option),
        ),
      cacheOptions,
    );
    const messageSlotDataCache = yield* Cache.makeWith<string, Option.Option<MessageSlot>, unknown>(
      (messageId) =>
        sheetApisClient.withServiceUser(
          sheetApisClient.messageSlot
            .getMessageSlotData({ query: { messageId } })
            .pipe(Effect.option),
        ),
      cacheOptions,
    );

    return {
      getMessageCheckinData: Effect.fn("MessageLookup.getMessageCheckinData")(function* (
        messageId: string,
      ) {
        return yield* Cache.get(messageCheckinDataCache, messageId);
      }),
      getMessageCheckinMembers: Effect.fn("MessageLookup.getMessageCheckinMembers")(function* (
        messageId: string,
      ) {
        return yield* Cache.get(messageCheckinMembersCache, messageId);
      }),
      getMessageRoomOrder: Effect.fn("MessageLookup.getMessageRoomOrder")(function* (
        messageId: string,
      ) {
        return yield* Cache.get(messageRoomOrderCache, messageId);
      }),
      getMessageSlotData: Effect.fn("MessageLookup.getMessageSlotData")(function* (
        messageId: string,
      ) {
        return yield* Cache.get(messageSlotDataCache, messageId);
      }),
    } satisfies {
      readonly getMessageCheckinData: (
        messageId: string,
      ) => Effect.Effect<Option.Option<MessageCheckin>, unknown>;
      readonly getMessageCheckinMembers: (
        messageId: string,
      ) => Effect.Effect<ReadonlyArray<MessageCheckinMember>, unknown>;
      readonly getMessageRoomOrder: (
        messageId: string,
      ) => Effect.Effect<Option.Option<MessageRoomOrder>, unknown>;
      readonly getMessageSlotData: (
        messageId: string,
      ) => Effect.Effect<Option.Option<MessageSlot>, unknown>;
    };
  }),
}) {
  static layer = Layer.effect(MessageLookup, this.make).pipe(Layer.provide(SheetApisClient.layer));
}
