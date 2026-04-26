import { describe, expect, it, vi } from "vitest";
import { Effect, Layer, Option } from "effect";
import { MessageLookup } from "./messageLookup";
import { SheetApisClient } from "./sheetApisClient";

const makeSheetApisClient = () => {
  const getMessageCheckinData = vi.fn(({ query }: { query: { messageId: string } }) =>
    Effect.succeed({
      messageId: query.messageId,
      messageChannelId: "channel-1",
      checkinChannelId: "checkin-channel-1",
      checkinMessageId: "checkin-message-1",
      title: "Checkin",
    }),
  );
  const getMessageCheckinMembers = vi.fn(({ query }: { query: { messageId: string } }) =>
    Effect.succeed([
      {
        messageId: query.messageId,
        memberId: "member-1",
        checkinAt: null,
      },
    ]),
  );
  const getMessageRoomOrder = vi.fn(({ query }: { query: { messageId: string } }) =>
    Effect.succeed({
      messageId: query.messageId,
      messageChannelId: "channel-1",
      roomOrderMessageId: "room-order-message-1",
      title: "Room order",
    }),
  );
  const getMessageSlotData = vi.fn(({ query }: { query: { messageId: string } }) =>
    Effect.succeed({
      messageId: query.messageId,
      messageChannelId: "channel-1",
      slotMessageId: "slot-message-1",
      title: "Slot",
    }),
  );

  return {
    client: {
      withServiceUser: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
      messageCheckin: {
        getMessageCheckinData,
        getMessageCheckinMembers,
      },
      messageRoomOrder: {
        getMessageRoomOrder,
      },
      messageSlot: {
        getMessageSlotData,
      },
    } as never,
    getMessageCheckinData,
    getMessageCheckinMembers,
    getMessageRoomOrder,
    getMessageSlotData,
  };
};

const runLookup = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  sheetApisClient: typeof SheetApisClient.Service,
) =>
  effect.pipe(
    Effect.provide(Layer.effect(MessageLookup, MessageLookup.make)),
    Effect.provideService(SheetApisClient, sheetApisClient),
  );

describe("MessageLookup", () => {
  it("caches message checkin data lookups by message id", async () => {
    const { client, getMessageCheckinData } = makeSheetApisClient();

    const result = await Effect.runPromise(
      runLookup(
        Effect.gen(function* () {
          const lookup = yield* MessageLookup;
          const first = yield* lookup.getMessageCheckinData("message-1");
          const second = yield* lookup.getMessageCheckinData("message-1");
          return { first, second };
        }),
        client,
      ),
    );

    expect(getMessageCheckinData).toHaveBeenCalledTimes(1);
    expect(Option.isSome(result.first)).toBe(true);
    expect(result.second).toEqual(result.first);
  });

  it("caches checkin member, room order, and slot lookups independently", async () => {
    const { client, getMessageCheckinMembers, getMessageRoomOrder, getMessageSlotData } =
      makeSheetApisClient();

    const result = await Effect.runPromise(
      runLookup(
        Effect.gen(function* () {
          const lookup = yield* MessageLookup;
          const members = yield* lookup.getMessageCheckinMembers("message-1");
          yield* lookup.getMessageCheckinMembers("message-1");
          yield* lookup.getMessageRoomOrder("message-1");
          yield* lookup.getMessageRoomOrder("message-1");
          yield* lookup.getMessageSlotData("message-1");
          yield* lookup.getMessageSlotData("message-1");
          return { members };
        }),
        client,
      ),
    );

    expect(getMessageCheckinMembers).toHaveBeenCalledTimes(1);
    expect(result.members[0]?.messageId).toBe("message-1");
    expect(getMessageRoomOrder).toHaveBeenCalledTimes(1);
    expect(getMessageSlotData).toHaveBeenCalledTimes(1);
  });
});
