import { HttpApiBuilder } from "effect/unstable/httpapi";
import { catchSchemaErrorAsValidationError, makeArgumentError } from "typhoon-core/error";
import { Effect, HashSet, Layer, Option } from "effect";
import { Api } from "@/api";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import {
  getGuildMonitorAccessLevel,
  provideCurrentGuildUser,
  requireDiscordAccountId,
  requireGuildMember,
  requireMonitorGuild,
} from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageCheckinMember } from "@/schemas/messageCheckin";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { MessageCheckinService } from "@/services";

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

const getRequiredMessageCheckinRecord = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) =>
  messageCheckinService.getMessageCheckinData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () => Effect.fail(missingMessageCheckinError()),
      }),
    ),
  );

const requireRecordedParticipant = (
  members: ReadonlyArray<MessageCheckinMember>,
  memberId: string,
  message = "User is not a recorded participant on this check-in message",
) =>
  members.some((member) => member.memberId === memberId)
    ? Effect.void
    : Effect.fail(new Unauthorized({ message }));

const getCheckinAccessLevel = (user: SheetAuthUserInstance, guildId: string) =>
  getGuildMonitorAccessLevel(user, guildId).pipe(
    Effect.flatMap((accessLevel) =>
      accessLevel === "monitor"
        ? Effect.succeed<"monitor" | "participant">("monitor")
        : accessLevel === "member"
          ? Effect.succeed<"monitor" | "participant">("participant")
          : Effect.fail(new Unauthorized({ message: "User is not a member of this guild" })),
    ),
  );

type CheckinReadAccess =
  | { readonly _tag: "monitor" }
  | { readonly _tag: "participant"; readonly members: ReadonlyArray<MessageCheckinMember> };

const resolveCheckinReadAccess = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId: string,
) =>
  Effect.gen(function* () {
    const user = yield* SheetAuthUser;

    return yield* getCheckinAccessLevel(user, guildId).pipe(
      Effect.flatMap((accessLevel) =>
        accessLevel === "monitor"
          ? Effect.succeed<CheckinReadAccess>({ _tag: "monitor" })
          : messageCheckinService.getMessageCheckinMembers(messageId).pipe(
              Effect.flatMap((members) =>
                requireRecordedParticipant(members, user.accountId).pipe(
                  Effect.as<CheckinReadAccess>({
                    _tag: "participant",
                    members,
                  }),
                ),
              ),
            ),
      ),
    );
  });

export const requireCheckinUpsertAccess = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId?: string,
) =>
  messageCheckinService.getMessageCheckinData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          typeof guildId === "string"
            ? provideCurrentGuildUser(guildId, requireMonitorGuild(guildId))
            : denyLegacyMessageCheckinAccess(),
        onSome: (record) =>
          Option.match(getModernMessageGuildId(record), {
            onSome: (resolvedGuildId) =>
              provideCurrentGuildUser(resolvedGuildId, requireMonitorGuild(resolvedGuildId)),
            onNone: denyLegacyMessageCheckinAccess,
          }),
      }),
    ),
  );

export const requireCheckinMutationAccess = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId: string,
  memberId: string,
) =>
  Effect.gen(function* () {
    const user = yield* SheetAuthUser;

    return yield* HashSet.has(user.permissions, "bot") || HashSet.has(user.permissions, "app_owner")
      ? Effect.void
      : // Non-legacy check-in mutations remain self-service for regular users:
        // monitors can add members, but only the recorded participant can update/remove that member.
        requireDiscordAccountId(memberId).pipe(
          Effect.andThen(provideCurrentGuildUser(guildId, requireGuildMember(guildId))),
          Effect.andThen(messageCheckinService.getMessageCheckinMembers(messageId)),
          Effect.flatMap((members) => requireRecordedParticipant(members, memberId)),
        );
  });

export const requireMessageCheckinReadAccess = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          resolveCheckinReadAccess(messageCheckinService, messageId, guildId).pipe(
            Effect.as(record),
          ),
        onNone: denyLegacyMessageCheckinAccess,
      }),
    ),
  );

export const requireMessageCheckinMembersReadAccess = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          resolveCheckinReadAccess(messageCheckinService, messageId, guildId).pipe(
            Effect.flatMap((access) =>
              access._tag === "monitor"
                ? messageCheckinService.getMessageCheckinMembers(messageId)
                : Effect.succeed(access.members),
            ),
          ),
        onNone: denyLegacyMessageCheckinAccess,
      }),
    ),
  );

export const requireMessageCheckinParticipantMutationAccess = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  memberId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          requireCheckinMutationAccess(messageCheckinService, messageId, guildId, memberId),
        onNone: denyLegacyMessageCheckinAccess,
      }),
    ),
  );

export const requireMessageCheckinMonitorMutationAccess = (
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) => provideCurrentGuildUser(guildId, requireMonitorGuild(guildId)),
        onNone: denyLegacyMessageCheckinAccess,
      }),
    ),
  );

export const messageCheckinLayer = HttpApiBuilder.group(
  Api,
  "messageCheckin",
  Effect.fn(function* (handlers) {
    const messageCheckinService = yield* MessageCheckinService;

    return handlers
      .handle("getMessageCheckinData", ({ query }) =>
        requireMessageCheckinReadAccess(messageCheckinService, query.messageId).pipe(
          catchSchemaErrorAsValidationError,
        ),
      )
      .handle("upsertMessageCheckinData", ({ payload }) =>
        requireCheckinUpsertAccess(
          messageCheckinService,
          payload.messageId,
          typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
        )
          .pipe(
            Effect.andThen(
              messageCheckinService.upsertMessageCheckinData(payload.messageId, payload.data),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getMessageCheckinMembers", ({ query }) =>
        requireMessageCheckinMembersReadAccess(messageCheckinService, query.messageId).pipe(
          catchSchemaErrorAsValidationError,
        ),
      )
      .handle("addMessageCheckinMembers", ({ payload }) =>
        requireMessageCheckinMonitorMutationAccess(messageCheckinService, payload.messageId)
          .pipe(
            Effect.andThen(
              messageCheckinService.addMessageCheckinMembers(payload.messageId, payload.memberIds),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("setMessageCheckinMemberCheckinAt", ({ payload }) =>
        requireMessageCheckinParticipantMutationAccess(
          messageCheckinService,
          payload.messageId,
          payload.memberId,
        )
          .pipe(
            Effect.andThen(
              messageCheckinService.setMessageCheckinMemberCheckinAt(
                payload.messageId,
                payload.memberId,
                payload.checkinAt,
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("removeMessageCheckinMember", ({ payload }) =>
        requireMessageCheckinParticipantMutationAccess(
          messageCheckinService,
          payload.messageId,
          payload.memberId,
        )
          .pipe(
            Effect.andThen(
              messageCheckinService.removeMessageCheckinMember(payload.messageId, payload.memberId),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(Layer.provide([MessageCheckinService.layer, SheetAuthTokenAuthorizationLive]));
