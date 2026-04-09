import { HttpApiBuilder } from "effect/unstable/httpapi";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option } from "effect";
import { Api } from "@/api";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService, MessageSlotService } from "@/services";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";

const missingMessageSlotError = () =>
  makeArgumentError("Cannot get message slot data, the message might not be registered");

export const LEGACY_MESSAGE_SLOT_ACCESS_ERROR =
  "Legacy message slot records are no longer accessible";

export const denyLegacyMessageSlotAccess = () =>
  Effect.fail(new Unauthorized({ message: LEGACY_MESSAGE_SLOT_ACCESS_ERROR }));

type MessageSlotAccessService = Pick<typeof MessageSlotService.Service, "getMessageSlotData">;

const getRequiredMessageSlotRecord = Effect.fn("messageSlot.getRequiredMessageSlotRecord")(
  function* (messageSlotService: MessageSlotAccessService, messageId: string) {
    const record = yield* messageSlotService.getMessageSlotData(messageId);

    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessageSlotError());
    }

    return record.value;
  },
);

export const requireMessageSlotUpsertAccess = Effect.fn(
  "messageSlot.requireMessageSlotUpsertAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageSlotService: MessageSlotAccessService,
  messageId: string,
  guildId?: string,
) {
  const existingRecord = yield* messageSlotService.getMessageSlotData(messageId);

  if (Option.isNone(existingRecord)) {
    if (typeof guildId === "string") {
      return yield* authorizationService.provideCurrentGuildUser(
        guildId,
        authorizationService.requireMonitorGuild(guildId),
      );
    }

    return yield* denyLegacyMessageSlotAccess();
  }

  const resolvedGuildId = getModernMessageGuildId(existingRecord.value);
  if (Option.isNone(resolvedGuildId)) {
    return yield* denyLegacyMessageSlotAccess();
  }

  return yield* authorizationService.provideCurrentGuildUser(
    resolvedGuildId.value,
    authorizationService.requireMonitorGuild(resolvedGuildId.value),
  );
});

export const requireMessageSlotReadAccess = Effect.fn("messageSlot.requireMessageSlotReadAccess")(
  function* (
    authorizationService: typeof AuthorizationService.Service,
    messageSlotService: MessageSlotAccessService,
    messageId: string,
  ) {
    const record = yield* getRequiredMessageSlotRecord(messageSlotService, messageId);
    const guildId = getModernMessageGuildId(record);

    if (Option.isNone(guildId)) {
      return yield* denyLegacyMessageSlotAccess();
    }

    yield* authorizationService.provideCurrentGuildUser(
      guildId.value,
      authorizationService.requireGuildMember(guildId.value),
    );

    return record;
  },
);

export const messageSlotLayer = HttpApiBuilder.group(
  Api,
  "messageSlot",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const messageSlotService = yield* MessageSlotService;

    return handlers
      .handle("getMessageSlotData", ({ query }) =>
        requireMessageSlotReadAccess(authorizationService, messageSlotService, query.messageId),
      )
      .handle("upsertMessageSlotData", ({ payload }) =>
        Effect.gen(function* () {
          yield* requireMessageSlotUpsertAccess(
            authorizationService,
            messageSlotService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          );

          return yield* messageSlotService.upsertMessageSlotData(payload.messageId, payload.data);
        }),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MessageSlotService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
