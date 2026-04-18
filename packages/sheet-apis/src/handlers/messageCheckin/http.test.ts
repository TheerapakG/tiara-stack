import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, ServiceMap } from "effect";
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
import { AuthorizationService, MessageCheckinService } from "@/services";
import { getFailure, liveGuildServices, withUser } from "@/test-utils/guildTestHelpers";

type MessageCheckinAccessService = Pick<
  typeof MessageCheckinService.Service,
  "getMessageCheckinData" | "getMessageCheckinMembers"
>;
type AuthorizationServiceApi = ServiceMap.Service.Shape<typeof AuthorizationService>;

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
    guildId: Option.fromNullishOr(guildId),
    messageChannelId: Option.fromNullishOr(messageChannelId),
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
    getMessageCheckinData: () => Effect.succeed(Option.fromNullishOr(options?.record)),
    getMessageCheckinMembers: () => Effect.succeed([...(options?.members ?? [])]),
  }) satisfies MessageCheckinAccessService;

const withAuthorization = Effect.fnUntraced(function* <A, E, R>(
  f: (authorizationService: AuthorizationServiceApi) => Effect.Effect<A, E, R>,
) {
  const authorizationService = yield* AuthorizationService.make;
  return yield* f(authorizationService);
});

describe("messageCheckin legacy access", () => {
  it.effect(
    "denies legacy reads for bot users",
    Effect.fnUntraced(function* () {
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        withAuthorization((authorizationService) =>
          requireMessageCheckinReadAccess(authorizationService, service, "message-1"),
        ).pipe(withUser(["bot"]), liveGuildServices()),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect(
    "denies partially legacy reads for regular users",
    Effect.fnUntraced(function* () {
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: "guild-1", messageChannelId: null }),
      });

      const error = yield* getFailure(
        withAuthorization((authorizationService) =>
          requireMessageCheckinReadAccess(authorizationService, service, "message-1"),
        ).pipe(
          withUser([], { accountId: "discord-account-1", userId: "user-1" }),
          liveGuildServices(),
        ),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect(
    "denies legacy member reads for bot users",
    Effect.fnUntraced(function* () {
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        withAuthorization((authorizationService) =>
          requireMessageCheckinMembersReadAccess(authorizationService, service, "message-1"),
        ).pipe(withUser(["bot"]), liveGuildServices()),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect(
    "denies legacy add-member mutations before the service call runs",
    Effect.fnUntraced(function* () {
      let mutationCalls = 0;
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        withAuthorization((authorizationService) =>
          requireMessageCheckinMonitorMutationAccess(authorizationService, service, "message-1"),
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

  it.effect(
    "denies legacy participant mutations before the service call runs",
    Effect.fnUntraced(function* () {
      let mutationCalls = 0;
      const service = makeMessageCheckinService({
        record: makeMessageCheckinRecord({ guildId: null, messageChannelId: null }),
      });

      const error = yield* getFailure(
        withAuthorization((authorizationService) =>
          requireMessageCheckinParticipantMutationAccess(
            authorizationService,
            service,
            "message-1",
            "discord-account-1",
          ),
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

  it.effect(
    "denies creating a missing legacy check-in record",
    Effect.fnUntraced(function* () {
      const service = makeMessageCheckinService();

      const error = yield* getFailure(
        withAuthorization((authorizationService) =>
          requireCheckinUpsertAccess(authorizationService, service, "message-1"),
        ).pipe(withUser(["bot"]), liveGuildServices()),
      );

      expect(error).toBeInstanceOf(Unauthorized);
      expect((error as Unauthorized).message).toBe(LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR);
    }),
  );

  it.effect(
    "allows modern upsert for monitor access",
    Effect.fnUntraced(function* () {
      yield* withAuthorization((authorizationService) =>
        requireCheckinUpsertAccess(
          authorizationService,
          makeMessageCheckinService(),
          "message-1",
          "guild-1",
        ),
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

  it.effect(
    "allows modern monitor reads",
    Effect.fnUntraced(function* () {
      const record = yield* withAuthorization((authorizationService) =>
        requireMessageCheckinReadAccess(
          authorizationService,
          makeMessageCheckinService({
            record: makeMessageCheckinRecord(),
          }),
          "message-1",
        ),
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

  it.effect(
    "allows modern monitor to add members",
    Effect.fnUntraced(function* () {
      yield* withAuthorization((authorizationService) =>
        requireMessageCheckinMonitorMutationAccess(
          authorizationService,
          makeMessageCheckinService({
            record: makeMessageCheckinRecord(),
          }),
          "message-1",
        ),
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

  it.effect(
    "allows recorded participant mutations for modern records",
    Effect.fnUntraced(function* () {
      yield* withAuthorization((authorizationService) =>
        requireMessageCheckinParticipantMutationAccess(
          authorizationService,
          makeMessageCheckinService({
            record: makeMessageCheckinRecord(),
            members: [
              makeMessageCheckinMember("discord-account-1"),
              makeMessageCheckinMember("discord-account-2"),
            ],
          }),
          "message-1",
          "discord-account-1",
        ),
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

  it.effect(
    "allows participant self-read behavior for modern records",
    Effect.fnUntraced(function* () {
      const members = yield* withAuthorization((authorizationService) =>
        requireMessageCheckinMembersReadAccess(
          authorizationService,
          makeMessageCheckinService({
            record: makeMessageCheckinRecord(),
            members: [
              makeMessageCheckinMember("discord-account-1"),
              makeMessageCheckinMember("discord-account-2"),
            ],
          }),
          "message-1",
        ),
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
