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

const getCheckinAccessLevel = (
  authorizationService: typeof AuthorizationService.Service,
  user: SheetAuthUserInstance,
  guildId: string,
) =>
  authorizationService
    .getGuildMonitorAccessLevel(user, guildId)
    .pipe(
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
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId: string,
) =>
  Effect.gen(function* () {
    const user = yield* SheetAuthUser;

    return yield* getCheckinAccessLevel(authorizationService, user, guildId).pipe(
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
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  guildId?: string,
) =>
  messageCheckinService.getMessageCheckinData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          typeof guildId === "string"
            ? authorizationService.provideCurrentGuildUser(
                guildId,
                authorizationService.requireMonitorGuild(guildId),
              )
            : denyLegacyMessageCheckinAccess(),
        onSome: (record) =>
          Option.match(getModernMessageGuildId(record), {
            onSome: (resolvedGuildId) =>
              authorizationService.provideCurrentGuildUser(
                resolvedGuildId,
                authorizationService.requireMonitorGuild(resolvedGuildId),
              ),
            onNone: denyLegacyMessageCheckinAccess,
          }),
      }),
    ),
  );

export const requireCheckinMutationAccess = (
  authorizationService: typeof AuthorizationService.Service,
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
        authorizationService.requireDiscordAccountId(memberId).pipe(
          Effect.andThen(
            authorizationService.provideCurrentGuildUser(
              guildId,
              authorizationService.requireGuildMember(guildId),
            ),
          ),
          Effect.andThen(messageCheckinService.getMessageCheckinMembers(messageId)),
          Effect.flatMap((members) => requireRecordedParticipant(members, memberId)),
        );
  });

export const requireMessageCheckinReadAccess = (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          resolveCheckinReadAccess(
            authorizationService,
            messageCheckinService,
            messageId,
            guildId,
          ).pipe(Effect.as(record)),
        onNone: denyLegacyMessageCheckinAccess,
      }),
    ),
  );

export const requireMessageCheckinMembersReadAccess = (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          resolveCheckinReadAccess(
            authorizationService,
            messageCheckinService,
            messageId,
            guildId,
          ).pipe(
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
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
  memberId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          requireCheckinMutationAccess(
            authorizationService,
            messageCheckinService,
            messageId,
            guildId,
            memberId,
          ),
        onNone: denyLegacyMessageCheckinAccess,
      }),
    ),
  );

export const requireMessageCheckinMonitorMutationAccess = (
  authorizationService: typeof AuthorizationService.Service,
  messageCheckinService: MessageCheckinAccessService,
  messageId: string,
) =>
  getRequiredMessageCheckinRecord(messageCheckinService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          authorizationService.provideCurrentGuildUser(
            guildId,
            authorizationService.requireMonitorGuild(guildId),
          ),
        onNone: denyLegacyMessageCheckinAccess,
      }),
    ),
  );

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
        requireCheckinUpsertAccess(
          authorizationService,
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
        requireMessageCheckinMembersReadAccess(
          authorizationService,
          messageCheckinService,
          query.messageId,
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("addMessageCheckinMembers", ({ payload }) =>
        requireMessageCheckinMonitorMutationAccess(
          authorizationService,
          messageCheckinService,
          payload.messageId,
        )
          .pipe(
            Effect.andThen(
              messageCheckinService.addMessageCheckinMembers(payload.messageId, payload.memberIds),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("setMessageCheckinMemberCheckinAt", ({ payload }) =>
        requireMessageCheckinParticipantMutationAccess(
          authorizationService,
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
          authorizationService,
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
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MessageCheckinService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
