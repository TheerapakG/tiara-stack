import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR,
  requireCheckinUpsertAccess,
  requireMessageCheckinParticipantMutationAccess,
  requireMessageCheckinMembersReadAccess,
  requireMessageCheckinMonitorMutationAccess,
  requireMessageCheckinReadAccess,
} from "./http";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { MessageCheckin, MessageCheckinMember } from "@/schemas/messageCheckin";
import type { MessageCheckinService } from "@/services/messageCheckin";
import { getFailure, liveGuildServices, withUser } from "@/test-utils/guildTestHelpers";

const makeMessageCheckinRecord = (overrides?: {
  readonly guildId?: string | null;
  readonly messageChannelId?: string | null;
}) => {
  const guildId = overrides && "guildId" in overrides ? overrides.guildId : "guild-1";
  const messageChannelId =
    overrides && "messageChannelId" in overrides ? overrides.messageChannelId : "message-channel-1";

  return new MessageCheckin({
    messageId: "message-1",
    initialMessage: "check in",
    hour: 1,
    channelId: "channel-1",
    roleId: Option.none(),
    guildId: Option.fromNullable(guildId),
    messageChannelId: Option.fromNullable(messageChannelId),
    createdByUserId: Option.some("creator-1"),
    createdAt: Option.none(),
    updatedAt: Option.none(),
    deletedAt: Option.none(),
  });
};

const makeMessageCheckinMember = (memberId: string) =>
  new MessageCheckinMember({
    messageId: "message-1",
    memberId,
    checkinAt: Option.none(),
    createdAt: Option.none(),
    updatedAt: Option.none(),
    deletedAt: Option.none(),
  });

const makeMessageCheckinService = (options?: {
  readonly record?: MessageCheckin | undefined;
  readonly members?: ReadonlyArray<MessageCheckinMember>;
}) =>
  ({
    getMessageCheckinData: () => Effect.succeed(Option.fromNullable(options?.record)),
    getMessageCheckinMembers: () => Effect.succeed([...(options?.members ?? [])]),
  }) as unknown as MessageCheckinService;

describe("messageCheckin legacy access", () => {
  it.effect("denies legacy reads for bot users", () =>
    Effect.gen(function* () {
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        requireMessageCheckinReadAccess(service, "message-1").pipe(
          withUser(["bot"]),
          liveGuildServices(),
        ),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect("denies partially legacy reads for regular users", () =>
    Effect.gen(function* () {
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: "guild-1", messageChannelId: null }),
      });

      const error = yield* getFailure(
        requireMessageCheckinReadAccess(service, "message-1").pipe(
          withUser([], { accountId: "discord-account-1", userId: "user-1" }),
          liveGuildServices(),
        ),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect("denies legacy member reads for bot users", () =>
    Effect.gen(function* () {
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        requireMessageCheckinMembersReadAccess(service, "message-1").pipe(
          withUser(["bot"]),
          liveGuildServices(),
        ),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect("denies legacy add-member mutations before the service call runs", () =>
    Effect.gen(function* () {
      let mutationCalls = 0;
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        requireMessageCheckinMonitorMutationAccess(service, "message-1").pipe(
          Effect.andThen(
            Effect.sync(() => {
              mutationCalls += 1;
            }),
          ),
          withUser(["bot"]),
          liveGuildServices(),
        ),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
      expect(mutationCalls).toBe(0);
    }),
  );

  it.effect("denies legacy participant mutations before the service call runs", () =>
    Effect.gen(function* () {
      let mutationCalls = 0;
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        requireMessageCheckinParticipantMutationAccess(
          service,
          "message-1",
          "discord-account-1",
        ).pipe(
          Effect.andThen(
            Effect.sync(() => {
              mutationCalls += 1;
            }),
          ),
          withUser(["bot"]),
          liveGuildServices(),
        ),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
      expect(mutationCalls).toBe(0);
    }),
  );

  it.effect("denies creating a missing legacy check-in record", () =>
    Effect.gen(function* () {
      const service = makeMessageCheckinService();

      const error = yield* getFailure(
        requireCheckinUpsertAccess(service, "message-1").pipe(
          withUser(["bot"]),
          liveGuildServices(),
        ),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect("allows modern upsert for monitor access", () =>
    Effect.gen(function* () {
      yield* requireCheckinUpsertAccess(makeMessageCheckinService(), "message-1", "guild-1").pipe(
        withUser([], { accountId: "discord-account-1", userId: "user-1" }),
        liveGuildServices({
          memberAccountId: "discord-account-1",
          memberRoles: ["monitor-role"],
          monitorRoleIds: ["monitor-role"],
        }),
      );
    }),
  );

  it.effect("allows modern monitor reads", () =>
    Effect.gen(function* () {
      const record = yield* requireMessageCheckinReadAccess(
        makeMessageCheckinService({
          record: makeMessageCheckinRecord(),
        }),
        "message-1",
      ).pipe(
        withUser([], { accountId: "discord-account-1", userId: "user-1" }),
        liveGuildServices({
          memberAccountId: "discord-account-1",
          memberRoles: ["monitor-role"],
          monitorRoleIds: ["monitor-role"],
        }),
      );

      expect(record.messageId).toBe("message-1");
    }),
  );

  it.effect("allows modern monitor to add members", () =>
    Effect.gen(function* () {
      yield* requireMessageCheckinMonitorMutationAccess(
        makeMessageCheckinService({
          record: makeMessageCheckinRecord(),
        }),
        "message-1",
      ).pipe(
        withUser([], { accountId: "discord-account-1", userId: "user-1" }),
        liveGuildServices({
          memberAccountId: "discord-account-1",
          memberRoles: ["monitor-role"],
          monitorRoleIds: ["monitor-role"],
        }),
      );
    }),
  );

  it.effect("allows recorded participant mutations for modern records", () =>
    Effect.gen(function* () {
      yield* requireMessageCheckinParticipantMutationAccess(
        makeMessageCheckinService({
          record: makeMessageCheckinRecord(),
          members: [
            makeMessageCheckinMember("discord-account-1"),
            makeMessageCheckinMember("discord-account-2"),
          ],
        }),
        "message-1",
        "discord-account-1",
      ).pipe(
        withUser(["account:discord:discord-account-1"], {
          accountId: "discord-account-1",
          userId: "user-1",
        }),
        liveGuildServices({
          memberAccountId: "discord-account-1",
          memberRoles: [],
          monitorRoleIds: ["monitor-role"],
        }),
      );
    }),
  );

  it.effect("allows participant self-read behavior for modern records", () =>
    Effect.gen(function* () {
      const members = yield* requireMessageCheckinMembersReadAccess(
        makeMessageCheckinService({
          record: makeMessageCheckinRecord(),
          members: [
            makeMessageCheckinMember("discord-account-1"),
            makeMessageCheckinMember("discord-account-2"),
          ],
        }),
        "message-1",
      ).pipe(
        withUser([], { accountId: "discord-account-1", userId: "user-1" }),
        liveGuildServices({
          memberAccountId: "discord-account-1",
          memberRoles: [],
          monitorRoleIds: ["monitor-role"],
        }),
      );

      expect(members.map((member) => member.memberId)).toEqual([
        "discord-account-1",
        "discord-account-2",
      ]);
    }),
  );
});
