import { HttpApiBuilder } from "effect/unstable/httpapi";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, HashSet, Layer, Match, Option } from "effect";
import { Api } from "@/api";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageCheckin, MessageCheckinMember } from "@/schemas/messageCheckin";
import { SheetAuthGuildUser } from "@/schemas/middlewares/sheetAuthGuildUser";
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

type MessageCheckinAuthContext = {
  readonly record: MessageCheckin;
  readonly guildId: string | null;
  readonly isLegacy: boolean;
};

type CheckinReadAccess =
  | { readonly _tag: "monitor" }
  | { readonly _tag: "participant"; readonly members: ReadonlyArray<MessageCheckinMember> };

const loadRequiredMessageCheckinRecord = Effect.fn(
  "messageCheckin.loadRequiredMessageCheckinRecord",
)(function* (messageCheckinService: MessageCheckinAccessService, messageId: string) {
  const record = yield* messageCheckinService.getMessageCheckinData(messageId);

  if (Option.isNone(record)) {
    return yield* Effect.fail(missingMessageCheckinError());
  }

  return record.value;
});

const resolveMessageCheckinAuthContext = (record: MessageCheckin): MessageCheckinAuthContext => {
  const guildId = Option.getOrElse(getModernMessageGuildId(record), () => null);

  return {
    record,
    guildId,
    isLegacy: guildId === null,
  };
};

const withResolvedMessageCheckinGuildUser = <A, E, R>(
  authorizationService: typeof AuthorizationService.Service,
  authContext: MessageCheckinAuthContext,
  effect: Effect.Effect<A, E, R>,
) =>
  (authContext.guildId === null
    ? effect
    : authorizationService.provideCurrentGuildUser(authContext.guildId, effect)) as Effect.Effect<
    A,
    E,
    Exclude<R, SheetAuthGuildUser>
  >;

const getRequiredMessageCheckinGuildId = Effect.fn(
  "messageCheckin.getRequiredMessageCheckinGuildId",
)(function* (authContext: MessageCheckinAuthContext) {
  if (authContext.isLegacy || authContext.guildId === null) {
    return yield* denyLegacyMessageCheckinAccess();
  }

  return authContext.guildId;
});

const resolveMessageCheckinUpsertGuildId = Effect.fn(
  "messageCheckin.resolveMessageCheckinUpsertGuildId",
)(function* (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId?: string,
) {
  const existingRecord = yield* messageCheckinService.getMessageCheckinData(messageId);

  if (Option.isNone(existingRecord)) {
    if (typeof guildId === "string") {
      return guildId;
    }

    return yield* denyLegacyMessageCheckinAccess();
  }

  return yield* getRequiredMessageCheckinGuildId(
    resolveMessageCheckinAuthContext(existingRecord.value),
  );
});

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
  guildId: string,
) {
  const accessLevel = yield* authorizationService.getCurrentGuildMonitorAccessLevel(guildId);

  if (accessLevel === "monitor") {
    return "monitor" as const;
  }

  if (accessLevel === "member") {
    return "participant" as const;
  }

  return yield* Effect.fail(new Unauthorized({ message: "User is not a member of this guild" }));
});

const requireMessageCheckinReadPermission = Effect.fn(
  "messageCheckin.requireMessageCheckinReadPermission",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  authContext: MessageCheckinAuthContext,
) {
  const guildId = yield* getRequiredMessageCheckinGuildId(authContext);
  const user = yield* SheetAuthUser;
  const accessLevel = yield* getCheckinAccessLevel(authorizationService, guildId);

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

const requireMessageCheckinMonitorPermission = Effect.fn(
  "messageCheckin.requireMessageCheckinMonitorPermission",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  authContext: MessageCheckinAuthContext,
) {
  const guildId = yield* getRequiredMessageCheckinGuildId(authContext);

  return yield* withResolvedMessageCheckinGuildUser(
    authorizationService,
    authContext,
    authorizationService.requireMonitorGuild(guildId),
  );
});

const requireMessageCheckinParticipantMutationPermission = Effect.fn(
  "messageCheckin.requireMessageCheckinParticipantMutationPermission",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  memberId: string,
  authContext: MessageCheckinAuthContext,
) {
  const user = yield* SheetAuthUser;

  if (HashSet.has(user.permissions, "service") || HashSet.has(user.permissions, "app_owner")) {
    return yield* getRequiredMessageCheckinGuildId(authContext).pipe(Effect.asVoid);
  }

  const guildId = yield* getRequiredMessageCheckinGuildId(authContext);

  // Non-legacy check-in mutations remain self-service for regular users:
  // monitors can add members, but only the recorded participant can update/remove that member.
  yield* authorizationService.requireDiscordAccountId(memberId);
  yield* withResolvedMessageCheckinGuildUser(
    authorizationService,
    authContext,
    authorizationService.requireGuildMember(guildId),
  );
  const members = yield* messageCheckinService.getMessageCheckinMembers(messageId);
  return yield* requireRecordedParticipant(members, memberId);
});

export const requireCheckinUpsertAccess = Effect.fn("messageCheckin.requireCheckinUpsertAccess")(
  function* (
    authorizationService: typeof AuthorizationService.Service,
    messageCheckinService: MessageCheckinAccessService,
    messageId: string,
    guildId?: string,
  ) {
    const resolvedGuildId = yield* resolveMessageCheckinUpsertGuildId(
      messageCheckinService,
      messageId,
      guildId,
    );

    return yield* authorizationService.provideCurrentGuildUser(
      resolvedGuildId,
      authorizationService.requireMonitorGuild(resolvedGuildId),
    );
  },
);

export const requireMessageCheckinReadAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinReadAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) {
  const record = yield* loadRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const authContext = resolveMessageCheckinAuthContext(record);

  yield* requireMessageCheckinReadPermission(
    authorizationService,
    messageCheckinService,
    messageId,
    authContext,
  );

  return authContext.record;
});

export const requireMessageCheckinMembersReadAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinMembersReadAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) {
  const record = yield* loadRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const authContext = resolveMessageCheckinAuthContext(record);
  const access = yield* requireMessageCheckinReadPermission(
    authorizationService,
    messageCheckinService,
    messageId,
    authContext,
  );

  return yield* Match.value(access).pipe(
    Match.tagsExhaustive({
      monitor: () => messageCheckinService.getMessageCheckinMembers(messageId),
      participant: (participantAccess) => Effect.succeed(participantAccess.members),
    }),
  );
});

export const requireMessageCheckinParticipantMutationAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinParticipantMutationAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  memberId: string,
) {
  const record = yield* loadRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const authContext = resolveMessageCheckinAuthContext(record);

  return yield* requireMessageCheckinParticipantMutationPermission(
    authorizationService,
    messageCheckinService,
    messageId,
    memberId,
    authContext,
  );
});

export const requireMessageCheckinMonitorMutationAccess = Effect.fn(
  "messageCheckin.requireMessageCheckinMonitorMutationAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) {
  const record = yield* loadRequiredMessageCheckinRecord(messageCheckinService, messageId);
  const authContext = resolveMessageCheckinAuthContext(record);

  return yield* requireMessageCheckinMonitorPermission(authorizationService, authContext);
});

export const messageCheckinLayer = HttpApiBuilder.group(
  Api,
  "messageCheckin",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const messageCheckinService = yield* MessageCheckinService;

    return handlers
      .handle(
        "getMessageCheckinData",
        Effect.fnUntraced(function* ({ query }) {
          return yield* requireMessageCheckinReadAccess(
            authorizationService,
            messageCheckinService,
            query.messageId,
          );
        }),
      )
      .handle(
        "upsertMessageCheckinData",
        Effect.fnUntraced(function* ({ payload }) {
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
        }),
      )
      .handle(
        "getMessageCheckinMembers",
        Effect.fnUntraced(function* ({ query }) {
          return yield* requireMessageCheckinMembersReadAccess(
            authorizationService,
            messageCheckinService,
            query.messageId,
          );
        }),
      )
      .handle(
        "addMessageCheckinMembers",
        Effect.fnUntraced(function* ({ payload }) {
          yield* requireMessageCheckinMonitorMutationAccess(
            authorizationService,
            messageCheckinService,
            payload.messageId,
          );

          return yield* messageCheckinService.addMessageCheckinMembers(
            payload.messageId,
            payload.memberIds,
          );
        }),
      )
      .handle(
        "setMessageCheckinMemberCheckinAt",
        Effect.fnUntraced(function* ({ payload }) {
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
        }),
      )
      .handle(
        "removeMessageCheckinMember",
        Effect.fnUntraced(function* ({ payload }) {
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
        }),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MessageCheckinService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
