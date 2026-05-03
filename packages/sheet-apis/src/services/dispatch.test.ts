import { describe, expect, it } from "@effect/vitest";
import { Effect, HashSet, Redacted } from "effect";
import { CHECKIN_BUTTON_CUSTOM_ID } from "sheet-ingress-api/discordComponents";
import { CheckinGenerateResult } from "sheet-ingress-api/schemas/checkin";
import { MessageRoomOrderRange } from "sheet-ingress-api/schemas/messageRoomOrder";
import {
  GeneratedRoomOrderEntry,
  RoomOrderGenerateResult,
} from "sheet-ingress-api/schemas/roomOrder";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { CheckinService } from "./checkin";
import { DispatchService } from "./dispatch";
import { IngressBotClient } from "./ingressBotClient";
import { MessageCheckinService } from "./messageCheckin";
import { MessageRoomOrderService } from "./messageRoomOrder";
import { RoomOrderService } from "./roomOrder";

type BotClientApi = typeof IngressBotClient.Service;
type CheckinServiceApi = typeof CheckinService.Service;
type DispatchServiceApi = typeof DispatchService.Service;
type MessageCheckinServiceApi = typeof MessageCheckinService.Service;
type MessageRoomOrderServiceApi = typeof MessageRoomOrderService.Service;
type RoomOrderServiceApi = typeof RoomOrderService.Service;
type UpdateMessage = (
  channelId: string,
  messageId: string,
  payload: unknown,
) => Effect.Effect<{ readonly id: string; readonly channel_id: string }, unknown>;

type Call = {
  readonly name: string;
  readonly args: ReadonlyArray<unknown>;
};

const testUser = {
  accountId: "discord-user-1",
  userId: "auth-user-1",
  permissions: HashSet.empty(),
  token: Redacted.make("token"),
};

const makeRoomOrderEntry = () =>
  new GeneratedRoomOrderEntry({
    rank: 0,
    position: 0,
    hour: 20,
    team: "Team A",
    tags: ["fill"],
    effectValue: 100,
  });

const makeRoomOrderResult = (content = "Room order content") =>
  new RoomOrderGenerateResult({
    content,
    runningChannelId: "running-channel-1",
    range: new MessageRoomOrderRange({ minRank: 0, maxRank: 1 }),
    rank: 0,
    hour: 20,
    monitor: "monitor-1",
    previousFills: ["old-fill"],
    fills: ["fill-1", "fill-2"],
    entries: [makeRoomOrderEntry()],
  });

const makeCheckinResult = (
  overrides: Partial<ConstructorParameters<typeof CheckinGenerateResult>[0]> = {},
) =>
  new CheckinGenerateResult({
    hour: 20,
    runningChannelId: "running-channel-1",
    checkinChannelId: "checkin-channel-1",
    fillCount: 5,
    roleId: "role-1",
    initialMessage: "Check in now",
    monitorCheckinMessage: "Check-in message sent!",
    monitorUserId: "monitor-1",
    monitorFailureMessage: null,
    fillIds: ["fill-1", "fill-2"],
    ...overrides,
  });

const makeBotClient = (calls: Call[]): BotClientApi => ({
  sendMessage: (channelId, payload) =>
    Effect.sync(() => {
      calls.push({ name: "sendMessage", args: [channelId, payload] });
      return {
        id: `${channelId}-message-${calls.length}`,
        channel_id: channelId,
      };
    }),
  updateMessage: (channelId, messageId, payload) =>
    Effect.sync(() => {
      calls.push({ name: "updateMessage", args: [channelId, messageId, payload] });
      return {
        id: messageId,
        channel_id: channelId,
      };
    }),
  updateOriginalInteractionResponse: (interactionToken, payload) =>
    Effect.sync(() => {
      calls.push({ name: "updateOriginalInteractionResponse", args: [interactionToken, payload] });
      return {
        id: "interaction-message-1",
        channel_id: "interaction-channel-1",
      };
    }),
});

const makeDispatchService = ({
  calls,
  checkinResult = makeCheckinResult(),
  roomOrderResult = makeRoomOrderResult(),
  updateMessage = makeBotClient(calls).updateMessage as UpdateMessage,
}: {
  readonly calls: Call[];
  readonly checkinResult?: CheckinGenerateResult;
  readonly roomOrderResult?: RoomOrderGenerateResult;
  readonly updateMessage?: UpdateMessage;
}) =>
  DispatchService.make.pipe(
    Effect.provideService(IngressBotClient, {
      ...makeBotClient(calls),
      updateMessage: updateMessage as BotClientApi["updateMessage"],
    }),
    Effect.provideService(CheckinService, {
      generate: (payload) =>
        Effect.sync(() => {
          calls.push({ name: "checkin.generate", args: [payload] });
          return checkinResult;
        }),
    } as CheckinServiceApi),
    Effect.provideService(RoomOrderService, {
      generate: (payload) =>
        Effect.sync(() => {
          calls.push({ name: "roomOrder.generate", args: [payload] });
          return roomOrderResult;
        }),
    } as RoomOrderServiceApi),
    Effect.provideService(MessageCheckinService, {
      persistMessageCheckin: (messageId: string, payload: unknown) =>
        Effect.sync(() => {
          calls.push({ name: "messageCheckin.persist", args: [messageId, payload] });
          return {} as never;
        }),
    } as unknown as MessageCheckinServiceApi),
    Effect.provideService(MessageRoomOrderService, {
      persistMessageRoomOrder: (messageId: string, payload: unknown) =>
        Effect.sync(() => {
          calls.push({ name: "messageRoomOrder.persist", args: [messageId, payload] });
          return {} as never;
        }),
    } as unknown as MessageRoomOrderServiceApi),
  ) as Effect.Effect<DispatchServiceApi, never>;

const runWithUser = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(SheetAuthUser, testUser)) as Effect.Effect<A, E>;

describe("DispatchService", () => {
  it.effect(
    "checkin sends the primary monitor message, persists the check-in, enables it, and sends tentative room order",
    () =>
      Effect.gen(function* () {
        const calls: Call[] = [];
        const dispatchService = yield* makeDispatchService({ calls });
        const result = yield* runWithUser(
          dispatchService.checkin({
            guildId: "guild-1",
            channelId: "running-channel-1",
            hour: 20,
          }),
        );

        expect(result).toMatchObject({
          hour: 20,
          runningChannelId: "running-channel-1",
          checkinChannelId: "checkin-channel-1",
          checkinMessageId: "checkin-channel-1-message-3",
          checkinMessageChannelId: "checkin-channel-1",
          primaryMessageId: "running-channel-1-message-2",
          primaryMessageChannelId: "running-channel-1",
          tentativeRoomOrderMessageId: "running-channel-1-message-7",
          tentativeRoomOrderMessageChannelId: "running-channel-1",
        });

        expect(calls.map((call) => call.name)).toEqual([
          "checkin.generate",
          "sendMessage",
          "sendMessage",
          "messageCheckin.persist",
          "updateMessage",
          "roomOrder.generate",
          "sendMessage",
          "messageRoomOrder.persist",
        ]);
        expect(calls[4]?.args[2]).toMatchObject({
          components: [
            {
              components: [expect.objectContaining({ custom_id: CHECKIN_BUTTON_CUSTOM_ID })],
            },
          ],
        });
        expect(calls[6]?.args[1]).toMatchObject({
          content: "(tentative)\nRoom order content",
        });
        expect(calls[3]?.args[1]).toMatchObject({
          data: { createdByUserId: "auth-user-1" },
        });
        expect(calls[7]?.args[1]).toMatchObject({
          data: { createdByUserId: "auth-user-1" },
        });
      }),
  );

  it.effect(
    "checkin interaction dispatch edits the original response and skips check-in persistence when no initial message exists",
    () =>
      Effect.gen(function* () {
        const calls: Call[] = [];
        const dispatchService = yield* makeDispatchService({
          calls,
          checkinResult: makeCheckinResult({
            fillCount: 4,
            initialMessage: null,
            monitorCheckinMessage: "No check-in message sent",
            fillIds: [],
          }),
        });

        const result = yield* runWithUser(
          dispatchService.checkin({
            guildId: "guild-1",
            channelName: "room-1",
            interactionToken: "token-1",
          }),
        );

        expect(result).toMatchObject({
          checkinMessageId: null,
          checkinMessageChannelId: null,
          primaryMessageId: "interaction-message-1",
          primaryMessageChannelId: "interaction-channel-1",
          tentativeRoomOrderMessageId: null,
        });
        expect(calls.map((call) => call.name)).toEqual([
          "checkin.generate",
          "updateOriginalInteractionResponse",
          "updateOriginalInteractionResponse",
        ]);
        expect(calls[1]?.args).toMatchObject([
          "token-1",
          { content: "Dispatching check-in...", flags: 64 },
        ]);
        expect(calls[2]?.args).toMatchObject([
          "token-1",
          { content: "No check-in message sent", flags: 64 },
        ]);
      }),
  );

  it.effect("room order sends disabled buttons, persists data, then enables buttons", () =>
    Effect.gen(function* () {
      const calls: Call[] = [];
      const dispatchService = yield* makeDispatchService({ calls });
      const result = yield* runWithUser(
        dispatchService.roomOrder({
          guildId: "guild-1",
          channelId: "running-channel-1",
          hour: 20,
        }),
      );

      expect(result).toEqual({
        messageId: "running-channel-1-message-2",
        messageChannelId: "running-channel-1",
        hour: 20,
        runningChannelId: "running-channel-1",
        rank: 0,
      });
      expect(calls.map((call) => call.name)).toEqual([
        "roomOrder.generate",
        "sendMessage",
        "messageRoomOrder.persist",
        "updateMessage",
      ]);
      expect(calls[1]?.args[1]).toMatchObject({
        components: [
          { components: expect.arrayContaining([expect.objectContaining({ disabled: true })]) },
        ],
      });
      expect(calls[3]?.args[2]).toMatchObject({
        components: [
          { components: expect.arrayContaining([expect.objectContaining({ disabled: false })]) },
        ],
      });
      expect(calls[2]?.args[1]).toMatchObject({
        data: { createdByUserId: "auth-user-1" },
      });
    }),
  );

  it.effect(
    "room order interaction dispatch edits the original response instead of sending a channel message",
    () =>
      Effect.gen(function* () {
        const calls: Call[] = [];
        const dispatchService = yield* makeDispatchService({ calls });
        const result = yield* runWithUser(
          dispatchService.roomOrder({
            guildId: "guild-1",
            channelName: "room-1",
            interactionToken: "token-1",
          }),
        );

        expect(result).toEqual({
          messageId: "interaction-message-1",
          messageChannelId: "interaction-channel-1",
          hour: 20,
          runningChannelId: "running-channel-1",
          rank: 0,
        });
        expect(calls.map((call) => call.name)).toEqual([
          "roomOrder.generate",
          "updateOriginalInteractionResponse",
          "messageRoomOrder.persist",
          "updateOriginalInteractionResponse",
        ]);
        expect(calls[1]?.args[1]).not.toHaveProperty("flags");
        expect(calls[3]?.args[1]).not.toHaveProperty("flags");
      }),
  );

  it.effect(
    "room order leaves disabled components when enabling buttons fails after persistence",
    () =>
      Effect.gen(function* () {
        const calls: Call[] = [];
        const dispatchService = yield* makeDispatchService({
          calls,
          updateMessage: (channelId, messageId, payload) =>
            Effect.sync(() => {
              calls.push({ name: "updateMessage", args: [channelId, messageId, payload] });
            }).pipe(Effect.andThen(Effect.fail(new Error("discord update failed")))),
        });

        const result = yield* runWithUser(
          dispatchService.roomOrder({
            guildId: "guild-1",
            channelId: "running-channel-1",
            hour: 20,
          }),
        );

        expect(result).toEqual({
          messageId: "running-channel-1-message-2",
          messageChannelId: "running-channel-1",
          hour: 20,
          runningChannelId: "running-channel-1",
          rank: 0,
        });
        expect(calls.map((call) => call.name)).toEqual([
          "roomOrder.generate",
          "sendMessage",
          "messageRoomOrder.persist",
          "updateMessage",
        ]);
      }),
  );
});
