import { HttpApiBuilder } from "@effect/platform";
import { MembersApiCacheView } from "dfx-discord-utils/discord";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import {
  getGuildMonitorAccessLevel,
  hasGuildPermission,
  requireBot,
  requireGuildMember,
  requireMonitorGuild,
  requireUserId,
} from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageCheckin, MessageCheckinMember } from "@/schemas/messageCheckin";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { GuildConfigService } from "@/services/guildConfig";
import { MessageCheckinService } from "@/services/messageCheckin";

const missingMessageCheckinError = () =>
  makeArgumentError("Cannot get message checkin data, the message might not be registered");

const getRequiredMessageCheckinRecord = (
  messageCheckinService: MessageCheckinService,
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

const requireLegacyMessageCheckinBotAccess = () =>
  requireBot("Legacy message check-in records are restricted to the bot");

const requireRecordedParticipant = (
  members: ReadonlyArray<MessageCheckinMember>,
  memberId: string,
  message = "User is not a recorded participant on this check-in message",
) =>
  members.some((member) => member.memberId === memberId)
    ? Effect.void
    : Effect.fail(new Unauthorized({ message }));

const getCheckinAccessLevel = (
  user: SheetAuthUser["Type"],
  guildId: string,
  membersCache: MembersApiCacheView,
  guildConfigService: GuildConfigService,
) =>
  // `member_guild:${guildId}` proves membership for this request, but we still
  // retry the live monitor-role check so monitors are not downgraded to
  // participant access when middleware guild-config resolution was transiently unavailable.
  getGuildMonitorAccessLevel(user, guildId, membersCache, guildConfigService).pipe(
    Effect.flatMap((accessLevel) =>
      accessLevel === "monitor"
        ? Effect.succeed<"monitor" | "participant">("monitor")
        : accessLevel === "member" || hasGuildPermission(user.permissions, "member_guild", guildId)
          ? Effect.succeed<"monitor" | "participant">("participant")
          : Effect.fail(new Unauthorized({ message: "User is not a member of this guild" })),
    ),
  );

type CheckinReadAccess =
  | { readonly _tag: "monitor" }
  | { readonly _tag: "participant"; readonly members: ReadonlyArray<MessageCheckinMember> };

const resolveCheckinReadAccess = (
  messageCheckinService: MessageCheckinService,
  messageId: string,
  guildId: string,
) =>
  Effect.all({
    user: SheetAuthUser,
    membersCache: MembersApiCacheView,
    guildConfigService: GuildConfigService,
  }).pipe(
    Effect.flatMap(({ user, membersCache, guildConfigService }) =>
      // Participant reads still need the current member list because that is
      // the authoritative recorded-participant check available in this pass.
      getCheckinAccessLevel(user, guildId, membersCache, guildConfigService).pipe(
        Effect.flatMap((accessLevel) =>
          accessLevel === "monitor"
            ? Effect.succeed<CheckinReadAccess>({ _tag: "monitor" })
            : messageCheckinService.getMessageCheckinMembers(messageId).pipe(
                Effect.flatMap((members) =>
                  requireRecordedParticipant(members, user.userId).pipe(
                    Effect.as<CheckinReadAccess>({
                      _tag: "participant",
                      members,
                    }),
                  ),
                ),
              ),
        ),
      ),
    ),
  );

const requireCheckinUpsertAccess = (
  messageCheckinService: MessageCheckinService,
  messageId: string,
  guildId?: string,
) =>
  messageCheckinService.getMessageCheckinData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          typeof guildId === "string"
            ? requireMonitorGuild(guildId)
            : requireLegacyMessageCheckinBotAccess(),
        onSome: (record) =>
          Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
            ? requireMonitorGuild(record.guildId.value)
            : requireLegacyMessageCheckinBotAccess(),
      }),
    ),
  );

const requireCheckinMutationAccess = (
  messageCheckinService: MessageCheckinService,
  messageId: string,
  guildId: string,
  memberId: string,
) =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      user.permissions.includes("bot") || user.permissions.includes("app_owner")
        ? Effect.void
        : // Non-legacy check-in mutations remain self-service for regular users:
          // monitors can add members, but only the recorded participant can update/remove that member.
          // `guildId` is record-derived here, so `requireGuildMember` usually falls back
          // to a live membership lookup instead of using a request-scoped shortcut.
          requireUserId(memberId).pipe(
            Effect.andThen(requireGuildMember(guildId)),
            Effect.andThen(messageCheckinService.getMessageCheckinMembers(messageId)),
            Effect.flatMap((members) => requireRecordedParticipant(members, memberId)),
          ),
    ),
  );

export const MessageCheckinLive = HttpApiBuilder.group(Api, "messageCheckin", (handlers) =>
  pipe(
    Effect.all({
      messageCheckinService: MessageCheckinService,
    }),
    Effect.map(({ messageCheckinService }) =>
      handlers
        .handle("getMessageCheckinData", ({ urlParams }) =>
          getRequiredMessageCheckinRecord(messageCheckinService, urlParams.messageId).pipe(
            Effect.flatMap((record) =>
              Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
                ? resolveCheckinReadAccess(
                    messageCheckinService,
                    urlParams.messageId,
                    record.guildId.value,
                  ).pipe(Effect.as(record))
                : requireLegacyMessageCheckinBotAccess().pipe(
                    Effect.andThen(Effect.succeed(record)),
                  ),
            ),
          ),
        )
        .handle("upsertMessageCheckinData", ({ payload }) =>
          requireCheckinUpsertAccess(
            messageCheckinService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          ).pipe(
            Effect.andThen(
              messageCheckinService.upsertMessageCheckinData(payload.messageId, payload.data),
            ),
          ),
        )
        .handle("getMessageCheckinMembers", ({ urlParams }) =>
          getRequiredMessageCheckinRecord(messageCheckinService, urlParams.messageId).pipe(
            Effect.flatMap((record) =>
              Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
                ? resolveCheckinReadAccess(
                    messageCheckinService,
                    urlParams.messageId,
                    record.guildId.value,
                  ).pipe(
                    Effect.flatMap((access) =>
                      access._tag === "monitor"
                        ? messageCheckinService.getMessageCheckinMembers(urlParams.messageId)
                        : Effect.succeed(access.members),
                    ),
                  )
                : requireLegacyMessageCheckinBotAccess().pipe(
                    Effect.andThen(
                      messageCheckinService.getMessageCheckinMembers(urlParams.messageId),
                    ),
                  ),
            ),
          ),
        )
        .handle("addMessageCheckinMembers", ({ payload }) =>
          getRequiredMessageCheckinRecord(messageCheckinService, payload.messageId).pipe(
            Effect.flatMap((record) =>
              Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
                ? requireMonitorGuild(record.guildId.value).pipe(
                    Effect.andThen(
                      messageCheckinService.addMessageCheckinMembers(
                        payload.messageId,
                        payload.memberIds,
                      ),
                    ),
                  )
                : requireLegacyMessageCheckinBotAccess().pipe(
                    Effect.andThen(
                      messageCheckinService.addMessageCheckinMembers(
                        payload.messageId,
                        payload.memberIds,
                      ),
                    ),
                  ),
            ),
          ),
        )
        .handle("setMessageCheckinMemberCheckinAt", ({ payload }) =>
          getRequiredMessageCheckinRecord(messageCheckinService, payload.messageId).pipe(
            Effect.flatMap((record) =>
              Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
                ? requireCheckinMutationAccess(
                    messageCheckinService,
                    payload.messageId,
                    record.guildId.value,
                    payload.memberId,
                  ).pipe(
                    Effect.andThen(
                      messageCheckinService.setMessageCheckinMemberCheckinAt(
                        payload.messageId,
                        payload.memberId,
                        payload.checkinAt,
                      ),
                    ),
                  )
                : requireLegacyMessageCheckinBotAccess().pipe(
                    Effect.andThen(
                      messageCheckinService.setMessageCheckinMemberCheckinAt(
                        payload.messageId,
                        payload.memberId,
                        payload.checkinAt,
                      ),
                    ),
                  ),
            ),
          ),
        )
        .handle("removeMessageCheckinMember", ({ payload }) =>
          getRequiredMessageCheckinRecord(messageCheckinService, payload.messageId).pipe(
            Effect.flatMap((record) =>
              Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
                ? requireCheckinMutationAccess(
                    messageCheckinService,
                    payload.messageId,
                    record.guildId.value,
                    payload.memberId,
                  ).pipe(
                    Effect.andThen(
                      messageCheckinService.removeMessageCheckinMember(
                        payload.messageId,
                        payload.memberId,
                      ),
                    ),
                  )
                : requireLegacyMessageCheckinBotAccess().pipe(
                    Effect.andThen(
                      messageCheckinService.removeMessageCheckinMember(
                        payload.messageId,
                        payload.memberId,
                      ),
                    ),
                  ),
            ),
          ),
        ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      MessageCheckinService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
