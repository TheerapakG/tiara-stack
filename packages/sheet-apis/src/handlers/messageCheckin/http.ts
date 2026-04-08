import { HttpApiBuilder } from "effect/unstable/httpapi";
import { catchSchemaErrorAsValidationError, makeArgumentError } from "typhoon-core/error";
import { Effect, HashSet, Layer, Option } from "effect";
import { Api } from "@/api";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageCheckinMember } from "@/schemas/messageCheckin";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { AuthorizationService, MessageCheckinService } from "@/services";

const missingMessageCheckinError = () =>
  makeArgumentError("Cannot get message checkin data, the message might not be registered");

export const LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR =
  "Legacy message check-in records are no longer accessible";

export const denyLegacyMessageCheckinAccess = () =>
  Effect.fail(new Unauthorized({ message: LEGACY_MESSAGE_CHECKIN_ACCESS_ERROR }));

type MessageCheckinAccessService = Pick<
  typeof MessageCheckinService.Service,
  "getMessageCheckinData" | "getMessageCheckinMembers"
>;
type SheetAuthUserInstance = typeof SheetAuthUser.Type;

const getRequiredMessageCheckinRecord = Effect.fn("messageCheckin.getRequiredMessageCheckinRecord")(
  function* (messageCheckinService: MessageCheckinAccessService, messageId: string) {
    const record = yield* messageCheckinService.getMessageCheckinData(messageId);

    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessageCheckinError());
    }

    return record.value;
  },
);

const requireRecordedParticipant = (
  members: ReadonlyArray<MessageCheckinMember>,
  memberId: string,
  message = "User is not a recorded participant on this check-in message",
) =>
  members.some((member) => member.memberId === memberId)
    ? Effect.void
    : Effect.fail(new Unauthorized({ message }));

const getCheckinAccessLevel = Effect.fn("messageCheckin.getCheckinAccessLevel")(function* (
  authorizationService: typeof AuthorizationService.Service,
  user: SheetAuthUserInstance,
  guildId: string,
) {
  const accessLevel = yield* authorizationService.getGuildMonitorAccessLevel(user, guildId);

  if (accessLevel === "monitor") {
    return "monitor" as const;
  }

  if (accessLevel === "member") {
    return "participant" as const;
  }

  return yield* Effect.fail(new Unauthorized({ message: "User is not a member of this guild" }));
});

type CheckinReadAccess =
  | { readonly _tag: "monitor" }
  | { readonly _tag: "participant"; readonly members: ReadonlyArray<MessageCheckinMember> };

const resolveCheckinReadAccess = Effect.fn("messageCheckin.resolveCheckinReadAccess")(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId: string,
) {
  const user = yield* SheetAuthUser;
  const accessLevel = yield* getCheckinAccessLevel(authorizationService, user, guildId);

  if (accessLevel === "monitor") {
    return { _tag: "monitor" } satisfies CheckinReadAccess;
  }

  const members = yield* messageCheckinService.getMessageCheckinMembers(messageId);
  yield* requireRecordedParticipant(members, user.accountId);

  return {
    _tag: "participant",
    members,
  } satisfies CheckinReadAccess;
});

export const requireCheckinUpsertAccess = Effect.fn("messageCheckin.requireCheckinUpsertAccess")(
  function* (
    authorizationService: typeof AuthorizationService.Service,
    messageCheckinService: MessageCheckinAccessService,
    messageId: string,
    guildId?: string,
  ) {
    const existingRecord = yield* messageCheckinService.getMessageCheckinData(messageId);

    if (Option.isNone(existingRecord)) {
      if (typeof guildId === "string") {
        return yield* authorizationService.provideCurrentGuildUser(
          guildId,
          authorizationService.requireMonitorGuild(guildId),
        );
      }

      return yield* denyLegacyMessageCheckinAccess();
    }

    const resolvedGuildId = getModernMessageGuildId(existingRecord.value);
    if (Option.isNone(resolvedGuildId)) {
      return yield* denyLegacyMessageCheckinAccess();
    }

    return yield* authorizationService.provideCurrentGuildUser(
      resolvedGuildId.value,
      authorizationService.requireMonitorGuild(resolvedGuildId.value),
    );
  },
);

export const requireCheckinMutationAccess = Effect.fn(
  "messageCheckin.requireCheckinMutationAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId: string,
  memberId: string,
) {
  const user = yield* SheetAuthUser;

  if (HashSet.has(user.permissions, "bot") || HashSet.has(user.permissions, "app_owner")) {
    return yield* Effect.void;
  }

  // Non-legacy check-in mutations remain self-service for regular users:
  // monitors can add members, but only the recorded participant can update/remove that member.
  yield* authorizationService.requireDiscordAccountId(memberId);
  yield* authorizationService.provideCurrentGuildUser(
    guildId,
    authorizationService.requireGuildMember(guildId),
  );
  const members = yield* messageCheckinService.getMessageCheckinMembers(messageId);
  return yield* requireRecordedParticipant(members, memberId);
});

export const requireMessageCheckinReadAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinReadAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) {
  const record = yield* getRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const guildId = getModernMessageGuildId(record);

  if (Option.isNone(guildId)) {
    return yield* denyLegacyMessageCheckinAccess();
  }

  yield* resolveCheckinReadAccess(
    authorizationService,
    messageCheckinService,
    messageId,
    guildId.value,
  );

  return record;
});

export const requireMessageCheckinMembersReadAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinMembersReadAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) {
  const record = yield* getRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const guildId = getModernMessageGuildId(record);

  if (Option.isNone(guildId)) {
    return yield* denyLegacyMessageCheckinAccess();
  }

  const access = yield* resolveCheckinReadAccess(
    authorizationService,
    messageCheckinService,
    messageId,
    guildId.value,
  );

  if (access._tag === "monitor") {
    return yield* messageCheckinService.getMessageCheckinMembers(messageId);
  }

  return access.members;
});

export const requireMessageCheckinParticipantMutationAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinParticipantMutationAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  memberId: string,
) {
  const record = yield* getRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const guildId = getModernMessageGuildId(record);

  if (Option.isNone(guildId)) {
    return yield* denyLegacyMessageCheckinAccess();
  }

  return yield* requireCheckinMutationAccess(
    authorizationService,
    messageCheckinService,
    messageId,
    guildId.value,
    memberId,
  );
});

export const requireMessageCheckinMonitorMutationAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinMonitorMutationAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) {
  const record = yield* getRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const guildId = getModernMessageGuildId(record);

  if (Option.isNone(guildId)) {
    return yield* denyLegacyMessageCheckinAccess();
  }

  return yield* authorizationService.provideCurrentGuildUser(
    guildId.value,
    authorizationService.requireMonitorGuild(guildId.value),
  );
});

export const messageCheckinLayer = HttpApiBuilder.group(
  Api,
  "messageCheckin",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const messageCheckinService = yield* MessageCheckinService;

    return handlers
      .handle("getMessageCheckinData", ({ query }) =>
        requireMessageCheckinReadAccess(
          authorizationService,
          messageCheckinService,
          query.messageId,
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("upsertMessageCheckinData", ({ payload }) =>
        Effect.gen(function* () {
          yield* requireCheckinUpsertAccess(
            authorizationService,
            messageCheckinService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          );

          return yield* messageCheckinService.upsertMessageCheckinData(
            payload.messageId,
            payload.data,
          );
        }).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getMessageCheckinMembers", ({ query }) =>
        requireMessageCheckinMembersReadAccess(
          authorizationService,
          messageCheckinService,
          query.messageId,
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("addMessageCheckinMembers", ({ payload }) =>
        Effect.gen(function* () {
          yield* requireMessageCheckinMonitorMutationAccess(
            authorizationService,
            messageCheckinService,
            payload.messageId,
          );

          return yield* messageCheckinService.addMessageCheckinMembers(
            payload.messageId,
            payload.memberIds,
          );
        }).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("setMessageCheckinMemberCheckinAt", ({ payload }) =>
        Effect.gen(function* () {
          yield* requireMessageCheckinParticipantMutationAccess(
            authorizationService,
            messageCheckinService,
            payload.messageId,
            payload.memberId,
          );

          return yield* messageCheckinService.setMessageCheckinMemberCheckinAt(
            payload.messageId,
            payload.memberId,
            payload.checkinAt,
          );
        }).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("removeMessageCheckinMember", ({ payload }) =>
        Effect.gen(function* () {
          yield* requireMessageCheckinParticipantMutationAccess(
            authorizationService,
            messageCheckinService,
            payload.messageId,
            payload.memberId,
          );

          return yield* messageCheckinService.removeMessageCheckinMember(
            payload.messageId,
            payload.memberId,
          );
        }).pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MessageCheckinService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
