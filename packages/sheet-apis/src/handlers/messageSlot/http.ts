import { HttpApiBuilder } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { requireBot, requireGuildMember, requireMonitorGuild } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageSlot } from "@/schemas/messageSlot";
import { GuildConfigService } from "@/services/guildConfig";
import { MessageSlotService } from "@/services/messageSlot";

const missingMessageSlotError = () =>
  makeArgumentError("Cannot get message slot data, the message might not be registered");

const getRequiredMessageSlotRecord = (messageSlotService: MessageSlotService, messageId: string) =>
  messageSlotService.getMessageSlotData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () => Effect.fail(missingMessageSlotError()),
      }),
    ),
  );

const requireLegacyMessageSlotBotAccess = () =>
  requireBot("Legacy message slot records are restricted to the bot");

const requireMessageSlotUpsertAccess = (
  messageSlotService: MessageSlotService,
  messageId: string,
  guildId?: string,
) =>
  messageSlotService.getMessageSlotData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          typeof guildId === "string"
            ? requireMonitorGuild(guildId)
            : requireLegacyMessageSlotBotAccess(),
        onSome: (record) =>
          Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
            ? requireMonitorGuild(record.guildId.value)
            : requireLegacyMessageSlotBotAccess(),
      }),
    ),
  );

export const MessageSlotLive = HttpApiBuilder.group(Api, "messageSlot", (handlers) =>
  pipe(
    Effect.all({
      messageSlotService: MessageSlotService,
    }),
    Effect.map(({ messageSlotService }) =>
      handlers
        .handle("getMessageSlotData", ({ urlParams }) =>
          getRequiredMessageSlotRecord(messageSlotService, urlParams.messageId).pipe(
            Effect.flatMap((record) =>
              Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
                ? requireGuildMember(record.guildId.value).pipe(
                    Effect.andThen(Effect.succeed(record)),
                  )
                : requireLegacyMessageSlotBotAccess().pipe(Effect.andThen(Effect.succeed(record))),
            ),
          ),
        )
        .handle("upsertMessageSlotData", ({ payload }) =>
          requireMessageSlotUpsertAccess(
            messageSlotService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          ).pipe(
            Effect.andThen(
              messageSlotService.upsertMessageSlotData(payload.messageId, payload.data),
            ),
          ),
        ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      MessageSlotService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
