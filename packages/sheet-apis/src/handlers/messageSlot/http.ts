import { HttpApiBuilder } from "effect/unstable/httpapi";
import { catchSchemaErrorAsValidationError, makeArgumentError } from "typhoon-core/error";
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

const getRequiredMessageSlotRecord = (
  messageSlotService: MessageSlotAccessService,
  messageId: string,
) =>
  messageSlotService.getMessageSlotData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () => Effect.fail(missingMessageSlotError()),
      }),
    ),
  );

export const requireMessageSlotUpsertAccess = (
  authorizationService: typeof AuthorizationService.Service,
  messageSlotService: MessageSlotAccessService,
  messageId: string,
  guildId?: string,
) =>
  messageSlotService.getMessageSlotData(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          typeof guildId === "string"
            ? authorizationService.provideCurrentGuildUser(
                guildId,
                authorizationService.requireMonitorGuild(guildId),
              )
            : denyLegacyMessageSlotAccess(),
        onSome: (record) =>
          Option.match(getModernMessageGuildId(record), {
            onSome: (resolvedGuildId) =>
              authorizationService.provideCurrentGuildUser(
                resolvedGuildId,
                authorizationService.requireMonitorGuild(resolvedGuildId),
              ),
            onNone: denyLegacyMessageSlotAccess,
          }),
      }),
    ),
  );

export const requireMessageSlotReadAccess = (
  authorizationService: typeof AuthorizationService.Service,
  messageSlotService: MessageSlotAccessService,
  messageId: string,
) =>
  getRequiredMessageSlotRecord(messageSlotService, messageId).pipe(
    Effect.flatMap((record) =>
      Option.match(getModernMessageGuildId(record), {
        onSome: (guildId) =>
          authorizationService.provideCurrentGuildUser(
            guildId,
            authorizationService
              .requireGuildMember(guildId)
              .pipe(Effect.andThen(Effect.succeed(record))),
          ),
        onNone: denyLegacyMessageSlotAccess,
      }),
    ),
  );

export const messageSlotLayer = HttpApiBuilder.group(
  Api,
  "messageSlot",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const messageSlotService = yield* MessageSlotService;

    return handlers
      .handle("getMessageSlotData", ({ query }) =>
        requireMessageSlotReadAccess(
          authorizationService,
          messageSlotService,
          query.messageId,
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("upsertMessageSlotData", ({ payload }) =>
        requireMessageSlotUpsertAccess(
          authorizationService,
          messageSlotService,
          payload.messageId,
          typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
        )
          .pipe(
            Effect.andThen(
              messageSlotService.upsertMessageSlotData(payload.messageId, payload.data),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MessageSlotService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
