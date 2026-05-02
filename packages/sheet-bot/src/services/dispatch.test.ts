import { describe, expect, it } from "vitest";
import { Effect, HashSet, Redacted, Ref } from "effect";
import { DiscordREST } from "dfx";
import { DiscordApplication } from "dfx-discord-utils/discord";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { CheckinService } from "./checkin";
import { DispatchService } from "./dispatch";
import { MessageCheckinService } from "./messageCheckin";
import { MessageRoomOrderService } from "./messageRoomOrder";
import { RoomOrderService } from "./roomOrder";

const makeUser = () => ({
  accountId: "discord-user-1",
  userId: "user-1",
  permissions: HashSet.fromIterable(["monitor_guild:guild-1" as const]),
  token: Redacted.make("sheet-auth-session-token"),
});

const run = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  services: {
    readonly discordRest: unknown;
    readonly checkinService?: unknown;
    readonly roomOrderService?: unknown;
    readonly messageCheckinService?: unknown;
    readonly messageRoomOrderService?: unknown;
  },
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(DiscordREST, services.discordRest as never),
      Effect.provideService(DiscordApplication, { id: "application-1" } as never),
      Effect.provideService(SheetAuthUser, makeUser()),
      Effect.provideService(
        CheckinService,
        (services.checkinService ?? { generate: () => Effect.die("unexpected checkin") }) as never,
      ),
      Effect.provideService(
        RoomOrderService,
        (services.roomOrderService ?? {
          generate: () => Effect.die("unexpected room order"),
        }) as never,
      ),
      Effect.provideService(MessageCheckinService, (services.messageCheckinService ?? {}) as never),
      Effect.provideService(
        MessageRoomOrderService,
        (services.messageRoomOrderService ?? {}) as never,
      ),
    ) as Effect.Effect<A, E, never>,
  );

describe("DispatchService", () => {
  it("edits an interaction check-in response before sending the check-in prompt", async () => {
    const calls = Ref.makeUnsafe<string[]>([]);
    const checkinRecords = Ref.makeUnsafe<unknown[]>([]);
    const discordRest = {
      updateOriginalWebhookMessage: (applicationId: string, token: string) =>
        Ref.update(calls, (value) => [...value, `edit:${applicationId}:${token}`]).pipe(
          Effect.as({ id: "primary-1", channel_id: "interaction-channel" }),
        ),
      createMessage: (channelId: string) =>
        Ref.update(calls, (value) => [...value, `create:${channelId}`]).pipe(
          Effect.as({ id: `message-${channelId}`, channel_id: channelId }),
        ),
      updateMessage: (channelId: string, messageId: string) =>
        Ref.update(calls, (value) => [...value, `update:${channelId}:${messageId}`]).pipe(
          Effect.as({ id: messageId, channel_id: channelId }),
        ),
    };

    const result = await run(
      Effect.gen(function* () {
        const dispatchService = yield* DispatchService.make;
        return yield* dispatchService.checkin({
          guildId: "guild-1",
          channelName: "room-a",
          interactionToken: "interaction-token",
        });
      }),
      {
        discordRest,
        checkinService: {
          generate: () =>
            Effect.succeed({
              hour: 1,
              runningChannelId: "running-channel",
              checkinChannelId: "checkin-channel",
              fillCount: 0,
              roleId: null,
              initialMessage: "check in",
              monitorCheckinMessage: "summary",
              monitorUserId: null,
              monitorFailureMessage: null,
              fillIds: [],
            }),
        },
        messageCheckinService: {
          persistMessageCheckin: (_messageId: string, payload: { data: unknown }) =>
            Ref.update(checkinRecords, (value) => [...value, payload.data]),
        },
      },
    );

    expect(await Effect.runPromise(Ref.get(calls))).toEqual([
      "edit:application-1:interaction-token",
      "create:checkin-channel",
      "update:checkin-channel:message-checkin-channel",
      "edit:application-1:interaction-token",
    ]);
    expect(result.primaryMessageId).toBe("primary-1");
    expect(result.checkinMessageId).toBe("message-checkin-channel");
    expect(await Effect.runPromise(Ref.get(checkinRecords))).toMatchObject([
      { createdByUserId: "user-1" },
    ]);
  });

  it("sends channel-targeted check-in summary to the generated running channel", async () => {
    const calls = Ref.makeUnsafe<string[]>([]);
    const discordRest = {
      createMessage: (channelId: string) =>
        Ref.update(calls, (value) => [...value, `create:${channelId}`]).pipe(
          Effect.as({ id: `message-${channelId}`, channel_id: channelId }),
        ),
    };

    const result = await run(
      Effect.gen(function* () {
        const dispatchService = yield* DispatchService.make;
        return yield* dispatchService.checkin({
          guildId: "guild-1",
          channelName: "room-a",
        });
      }),
      {
        discordRest,
        checkinService: {
          generate: () =>
            Effect.succeed({
              hour: 1,
              runningChannelId: "running-channel",
              checkinChannelId: "checkin-channel",
              fillCount: 0,
              roleId: null,
              initialMessage: null,
              monitorCheckinMessage: "summary",
              monitorUserId: null,
              monitorFailureMessage: null,
              fillIds: [],
            }),
        },
      },
    );

    expect(await Effect.runPromise(Ref.get(calls))).toEqual(["create:running-channel"]);
    expect(result.primaryMessageChannelId).toBe("running-channel");
  });

  it("does not fail an interaction check-in after persistence when the final primary update fails", async () => {
    const updateCount = Ref.makeUnsafe(0);
    const checkinRecords = Ref.makeUnsafe<unknown[]>([]);
    const discordRest = {
      updateOriginalWebhookMessage: () =>
        Ref.updateAndGet(updateCount, (value) => value + 1).pipe(
          Effect.flatMap((count) =>
            count === 1
              ? Effect.succeed({ id: "primary-1", channel_id: "interaction-channel" })
              : Effect.fail("final update failed"),
          ),
        ),
      createMessage: (channelId: string) =>
        Effect.succeed({ id: `message-${channelId}`, channel_id: channelId }),
      updateMessage: (channelId: string, messageId: string) =>
        Effect.succeed({ id: messageId, channel_id: channelId }),
    };

    const result = await run(
      Effect.gen(function* () {
        const dispatchService = yield* DispatchService.make;
        return yield* dispatchService.checkin({
          guildId: "guild-1",
          channelName: "room-a",
          interactionToken: "interaction-token",
        });
      }),
      {
        discordRest,
        checkinService: {
          generate: () =>
            Effect.succeed({
              hour: 1,
              runningChannelId: "running-channel",
              checkinChannelId: "checkin-channel",
              fillCount: 0,
              roleId: null,
              initialMessage: "check in",
              monitorCheckinMessage: "summary",
              monitorUserId: null,
              monitorFailureMessage: null,
              fillIds: [],
            }),
        },
        messageCheckinService: {
          persistMessageCheckin: (_messageId: string, payload: { data: unknown }) =>
            Ref.update(checkinRecords, (value) => [...value, payload.data]),
        },
      },
    );

    expect(result.primaryMessageId).toBe("primary-1");
    expect(await Effect.runPromise(Ref.get(updateCount))).toBe(2);
    expect(await Effect.runPromise(Ref.get(checkinRecords))).toHaveLength(1);
  });

  it("fails an interaction check-in final update when no durable side effects exist", async () => {
    const updateCount = Ref.makeUnsafe(0);
    const discordRest = {
      updateOriginalWebhookMessage: () =>
        Ref.updateAndGet(updateCount, (value) => value + 1).pipe(
          Effect.flatMap((count) =>
            count === 1
              ? Effect.succeed({ id: "primary-1", channel_id: "interaction-channel" })
              : Effect.fail("final update failed"),
          ),
        ),
    };

    await expect(
      run(
        Effect.gen(function* () {
          const dispatchService = yield* DispatchService.make;
          return yield* dispatchService.checkin({
            guildId: "guild-1",
            channelName: "room-a",
            interactionToken: "interaction-token",
          });
        }),
        {
          discordRest,
          checkinService: {
            generate: () =>
              Effect.succeed({
                hour: 1,
                runningChannelId: "running-channel",
                checkinChannelId: "checkin-channel",
                fillCount: 0,
                roleId: null,
                initialMessage: null,
                monitorCheckinMessage: "summary",
                monitorUserId: null,
                monitorFailureMessage: null,
                fillIds: [],
              }),
          },
        },
      ),
    ).rejects.toThrow("Failed to update deferred interaction response");

    expect(await Effect.runPromise(Ref.get(updateCount))).toBe(2);
  });

  it("edits and persists room order when an interaction token is provided", async () => {
    const roomOrderRecords = Ref.makeUnsafe<unknown[]>([]);
    const discordRest = {
      updateOriginalWebhookMessage: () =>
        Effect.succeed({ id: "room-order-message", channel_id: "interaction-channel" }),
    };

    const result = await run(
      Effect.gen(function* () {
        const dispatchService = yield* DispatchService.make;
        return yield* dispatchService.roomOrder({
          guildId: "guild-1",
          channelName: "room-a",
          interactionToken: "interaction-token",
        });
      }),
      {
        discordRest,
        roomOrderService: {
          generate: () =>
            Effect.succeed({
              content: "room order",
              runningChannelId: "running-channel",
              range: { minRank: 0, maxRank: 0 },
              rank: 0,
              hour: 1,
              monitor: null,
              previousFills: [],
              fills: [],
              entries: [],
            }),
        },
        messageRoomOrderService: {
          persistMessageRoomOrder: (_messageId: string, payload: { data: unknown }) =>
            Ref.update(roomOrderRecords, (value) => [...value, payload.data]),
        },
      },
    );

    expect(result.messageId).toBe("room-order-message");
    expect(result.messageChannelId).toBe("interaction-channel");
    expect(await Effect.runPromise(Ref.get(roomOrderRecords))).toMatchObject([
      { createdByUserId: "user-1" },
    ]);
  });

  it("sends room order to the generated running channel without an interaction token", async () => {
    const discordRest = {
      createMessage: (channelId: string) =>
        Effect.succeed({ id: "room-order-message", channel_id: channelId }),
      updateMessage: (channelId: string, messageId: string) =>
        Effect.succeed({ id: messageId, channel_id: channelId }),
    };

    const result = await run(
      Effect.gen(function* () {
        const dispatchService = yield* DispatchService.make;
        return yield* dispatchService.roomOrder({
          guildId: "guild-1",
          channelName: "room-a",
        });
      }),
      {
        discordRest,
        roomOrderService: {
          generate: () =>
            Effect.succeed({
              content: "room order",
              runningChannelId: "running-channel",
              range: { minRank: 0, maxRank: 0 },
              rank: 0,
              hour: 1,
              monitor: null,
              previousFills: [],
              fills: [],
              entries: [],
            }),
        },
        messageRoomOrderService: {
          persistMessageRoomOrder: () => Effect.void,
        },
      },
    );

    expect(result.messageChannelId).toBe("running-channel");
    expect(result.runningChannelId).toBe("running-channel");
  });

  it("does not fail room order after persistence when enabling components fails", async () => {
    const roomOrderRecords = Ref.makeUnsafe<unknown[]>([]);
    const discordRest = {
      createMessage: (channelId: string) =>
        Effect.succeed({ id: "room-order-message", channel_id: channelId }),
      updateMessage: () => Effect.fail("enable failed"),
    };

    const result = await run(
      Effect.gen(function* () {
        const dispatchService = yield* DispatchService.make;
        return yield* dispatchService.roomOrder({
          guildId: "guild-1",
          channelName: "room-a",
        });
      }),
      {
        discordRest,
        roomOrderService: {
          generate: () =>
            Effect.succeed({
              content: "room order",
              runningChannelId: "running-channel",
              range: { minRank: 0, maxRank: 0 },
              rank: 0,
              hour: 1,
              monitor: null,
              previousFills: [],
              fills: [],
              entries: [],
            }),
        },
        messageRoomOrderService: {
          persistMessageRoomOrder: (_messageId: string, payload: { data: unknown }) =>
            Ref.update(roomOrderRecords, (value) => [...value, payload.data]),
        },
      },
    );

    expect(result.messageId).toBe("room-order-message");
    expect(result.messageChannelId).toBe("running-channel");
    expect(await Effect.runPromise(Ref.get(roomOrderRecords))).toHaveLength(1);
  });
});
