import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option } from "effect";
import { MessageSlotRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { SheetAuthGuildUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthGuildUser";
import { MessageSlot } from "sheet-ingress-api/schemas/messageSlot";
import { AuthorizationService, MessageSlotService } from "@/services";
import { Unauthorized } from "typhoon-core/error";

const missingMessageSlotError = () =>
  makeArgumentError("Cannot get message slot data, the message might not be registered");

export const LEGACY_MESSAGE_SLOT_ACCESS_ERROR =
  "Legacy message slot records are no longer accessible";

const denyLegacyMessageSlotAccess = () =>
  Effect.fail(new Unauthorized({ message: LEGACY_MESSAGE_SLOT_ACCESS_ERROR }));

type MessageSlotAccessService = Pick<typeof MessageSlotService.Service, "getMessageSlotData">;

type MessageSlotAuthContext = {
  readonly record: MessageSlot;
  readonly guildId: string | null;
  readonly isLegacy: boolean;
};

const loadRequiredMessageSlotRecord = Effect.fn("messageSlot.loadRequiredMessageSlotRecord")(
  function* (messageSlotService: MessageSlotAccessService, messageId: string) {
    const record = yield* messageSlotService.getMessageSlotData(messageId);

    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessageSlotError());
    }

    return record.value;
  },
);

const resolveMessageSlotAuthContext = (record: MessageSlot): MessageSlotAuthContext => {
  const guildId = Option.getOrElse(getModernMessageGuildId(record), () => null);

  return {
    record,
    guildId,
    isLegacy: guildId === null,
  };
};

const getRequiredMessageSlotGuildId = Effect.fn("messageSlot.getRequiredMessageSlotGuildId")(
  function* (authContext: MessageSlotAuthContext) {
    if (authContext.isLegacy || authContext.guildId === null) {
      return yield* denyLegacyMessageSlotAccess();
    }

    return authContext.guildId;
  },
);

const resolveMessageSlotUpsertGuildId = Effect.fn("messageSlot.resolveMessageSlotUpsertGuildId")(
  function* (messageSlotService: MessageSlotAccessService, messageId: string, guildId?: string) {
    const existingRecord = yield* messageSlotService.getMessageSlotData(messageId);

    if (Option.isNone(existingRecord)) {
      if (typeof guildId === "string") {
        return guildId;
      }

      return yield* denyLegacyMessageSlotAccess();
    }

    return yield* getRequiredMessageSlotGuildId(
      resolveMessageSlotAuthContext(existingRecord.value),
    );
  },
);

const withResolvedMessageSlotGuildUser = <A, E, R>(
  authorizationService: typeof AuthorizationService.Service,
  authContext: MessageSlotAuthContext,
  effect: Effect.Effect<A, E, R>,
) =>
  (authContext.guildId === null
    ? effect
    : authorizationService.provideCurrentGuildUser(authContext.guildId, effect)) as Effect.Effect<
    A,
    E,
    Exclude<R, SheetAuthGuildUser>
  >;

const requireMessageSlotReadPermission = Effect.fn("messageSlot.requireMessageSlotReadPermission")(
  function* (
    authorizationService: typeof AuthorizationService.Service,
    authContext: MessageSlotAuthContext,
  ) {
    const guildId = yield* getRequiredMessageSlotGuildId(authContext);

    return yield* withResolvedMessageSlotGuildUser(
      authorizationService,
      authContext,
      authorizationService.requireGuildMember(guildId),
    );
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
  const resolvedGuildId = yield* resolveMessageSlotUpsertGuildId(
    messageSlotService,
    messageId,
    guildId,
  );

  return yield* authorizationService.provideCurrentGuildUser(
    resolvedGuildId,
    authorizationService.requireMonitorGuild(resolvedGuildId),
  );
});

export const requireMessageSlotReadAccess = Effect.fn("messageSlot.requireMessageSlotReadAccess")(
  function* (
    authorizationService: typeof AuthorizationService.Service,
    messageSlotService: MessageSlotAccessService,
    messageId: string,
  ) {
    const record = yield* loadRequiredMessageSlotRecord(messageSlotService, messageId);
    const authContext = resolveMessageSlotAuthContext(record);

    yield* requireMessageSlotReadPermission(authorizationService, authContext);

    return authContext.record;
  },
);

export const messageSlotLayer = MessageSlotRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const messageSlotService = yield* MessageSlotService;

    return {
      "messageSlot.getMessageSlotData": Effect.fnUntraced(function* ({ query }) {
        return yield* requireMessageSlotReadAccess(
          authorizationService,
          messageSlotService,
          query.messageId,
        );
      }),
      "messageSlot.upsertMessageSlotData": Effect.fnUntraced(function* ({ payload }) {
        yield* requireMessageSlotUpsertAccess(
          authorizationService,
          messageSlotService,
          payload.messageId,
          typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
        );

        return yield* messageSlotService.upsertMessageSlotData(payload.messageId, payload.data);
      }),
    };
  }),
).pipe(Layer.provide([AuthorizationService.layer, MessageSlotService.layer]));
