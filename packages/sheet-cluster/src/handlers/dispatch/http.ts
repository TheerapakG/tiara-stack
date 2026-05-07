import { Effect, HashSet, Layer, Option, Schema } from "effect";
import { randomUUID } from "node:crypto";
import {
  type CheckinHandleButtonPayload,
  CheckinDispatchPayload,
  DispatchAcceptedResult,
  DispatchRoomOrderButtonMethods,
  DispatchRpcs,
  type RoomOrderNextButtonPayload,
  type RoomOrderPinTentativeButtonPayload,
  type RoomOrderPreviousButtonPayload,
  type RoomOrderSendButtonPayload,
  MESSAGE_ROOM_ORDER_NOT_REGISTERED_ERROR_MESSAGE,
  RoomOrderDispatchPayload,
} from "sheet-ingress-api/sheet-apis-rpc";
import { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import type { PermissionSet } from "sheet-ingress-api/schemas/permissions";
import { makeArgumentError, Unauthorized } from "typhoon-core/error";
import {
  DispatchCreationEntity,
  DispatchMessageEntity,
  dispatchCreationEntityId,
  dispatchMessageEntityId,
} from "@/cluster";
import { normalizeDispatchError } from "@/handlers/shared/dispatchError";
import {
  DispatchJobs,
  SheetApisClient,
  hasSameDispatchJobPayload,
  type DispatchRequester,
} from "@/services";
import {
  interactionTokenExpirySafetyMarginMs,
  interactionTokenLifetimeMs,
} from "sheet-ingress-api/sheet-apis-rpc";

const clampInteractionDeadline = (
  interactionDeadlineEpochMs: number | undefined,
  interactionToken: string | undefined,
) =>
  interactionDeadlineEpochMs === undefined || interactionToken === undefined
    ? undefined
    : Math.min(
        interactionDeadlineEpochMs,
        Date.now() + interactionTokenLifetimeMs - interactionTokenExpirySafetyMarginMs,
      );

type MessageDispatchRequest =
  | {
      readonly messageId: string;
      readonly operation: "checkinButton";
      readonly payload: CheckinHandleButtonPayload;
      readonly requester: DispatchRequester;
    }
  | {
      readonly messageId: string;
      readonly operation: "roomOrderPreviousButton";
      readonly payload: RoomOrderPreviousButtonPayload;
      readonly requester: DispatchRequester;
      readonly authorizedRoomOrder: MessageRoomOrder;
    }
  | {
      readonly messageId: string;
      readonly operation: "roomOrderNextButton";
      readonly payload: RoomOrderNextButtonPayload;
      readonly requester: DispatchRequester;
      readonly authorizedRoomOrder: MessageRoomOrder;
    }
  | {
      readonly messageId: string;
      readonly operation: "roomOrderSendButton";
      readonly payload: RoomOrderSendButtonPayload;
      readonly requester: DispatchRequester;
      readonly authorizedRoomOrder: MessageRoomOrder;
    }
  | {
      readonly messageId: string;
      readonly operation: "roomOrderPinTentativeButton";
      readonly payload: RoomOrderPinTentativeButtonPayload;
      readonly requester: DispatchRequester;
      readonly authorizedRoomOrder: MessageRoomOrder | null;
    };

const acceptedResult = ({
  dispatchRequestId,
  entityType,
  entityId,
  operation,
}: Omit<DispatchAcceptedResult, "status">): DispatchAcceptedResult => ({
  dispatchRequestId,
  entityType,
  entityId,
  operation,
  status: "accepted",
});

const captureRequester = Effect.gen(function* () {
  const user = yield* SheetAuthUser;
  return {
    accountId: user.accountId,
    userId: user.userId,
  } satisfies DispatchRequester;
});

const hasBasePrivilegedPermission = (permissions: PermissionSet) =>
  HashSet.has(permissions, "service") || HashSet.has(permissions, "app_owner");

const isMissingMessageRoomOrderError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "ArgumentError" &&
  "message" in error &&
  error.message === MESSAGE_ROOM_ORDER_NOT_REGISTERED_ERROR_MESSAGE;

const requireCheckinButtonAccess = (messageId: string) =>
  Effect.gen(function* () {
    const user = yield* SheetAuthUser;
    if (hasBasePrivilegedPermission(user.permissions)) {
      return;
    }

    const sheetApis = (yield* SheetApisClient).get();
    const members = yield* sheetApis.messageCheckin
      .getMessageCheckinMembers({
        query: { messageId },
      })
      .pipe(Effect.mapError(normalizeDispatchError("Failed to verify check-in button access")));

    if (members.some((member) => member.memberId === user.accountId)) {
      return;
    }

    return yield* Effect.fail(
      new Unauthorized({ message: "User is not a recorded participant on this check-in message" }),
    );
  });

const requirePayloadRoomOrderMatch = (
  roomOrder: MessageRoomOrder,
  payload: RoomOrderPreviousButtonPayload,
) =>
  Effect.gen(function* () {
    if (Option.isNone(roomOrder.guildId) || Option.isNone(roomOrder.messageChannelId)) {
      return yield* Effect.fail(
        new Unauthorized({ message: "Legacy message room order records are no longer accessible" }),
      );
    }

    if (
      roomOrder.guildId.value !== payload.guildId ||
      roomOrder.messageChannelId.value !== payload.messageChannelId
    ) {
      return yield* Effect.fail(
        new Unauthorized({ message: "Room-order message authorization changed" }),
      );
    }
  });

const requireRegisteredRoomOrderButtonAccess = (payload: RoomOrderPreviousButtonPayload) =>
  Effect.gen(function* () {
    const sheetApis = (yield* SheetApisClient).get();
    const roomOrder = yield* sheetApis.messageRoomOrder
      .getMessageRoomOrder({
        query: { messageId: payload.messageId },
      })
      .pipe(Effect.mapError(normalizeDispatchError("Failed to verify room-order button access")));
    yield* requirePayloadRoomOrderMatch(roomOrder, payload);
    return roomOrder;
  });

const requireRoomOrderPinTentativeButtonAccess = (payload: RoomOrderPinTentativeButtonPayload) =>
  Effect.gen(function* () {
    const sheetApis = (yield* SheetApisClient).get();
    return yield* sheetApis.messageRoomOrder
      .getMessageRoomOrder({
        query: { messageId: payload.messageId },
      })
      .pipe(
        Effect.flatMap((roomOrder) => {
          return requirePayloadRoomOrderMatch(roomOrder, payload).pipe(Effect.as(roomOrder));
        }),
        Effect.catchIf(isMissingMessageRoomOrderError, () => Effect.succeed(null)),
        Effect.mapError(
          normalizeDispatchError("Failed to verify tentative room-order button access"),
        ),
      );
  });

export const dispatchLayer = DispatchRpcs.toLayer(
  Effect.gen(function* () {
    const dispatchJobs = yield* DispatchJobs;
    const creationClient = yield* DispatchCreationEntity.client;
    const messageClient = yield* DispatchMessageEntity.client;

    const acceptCreation = Effect.fnUntraced(function* ({
      payload,
      requester,
      operation,
    }: {
      readonly payload: CheckinDispatchPayload | RoomOrderDispatchPayload;
      readonly requester: DispatchRequester;
      readonly operation: "checkin" | "roomOrder";
    }) {
      const entityId = dispatchCreationEntityId(payload.guildId);
      const { interactionDeadlineEpochMs: payloadInteractionDeadlineEpochMs, ...operationPayload } =
        payload;
      if (
        typeof payload.interactionToken === "string" &&
        payloadInteractionDeadlineEpochMs === undefined
      ) {
        return yield* Effect.fail(
          makeArgumentError("Interaction dispatch payload is missing its token deadline", {
            dispatchRequestId: payload.dispatchRequestId,
          }),
        );
      }
      const interactionDeadlineEpochMs = clampInteractionDeadline(
        payloadInteractionDeadlineEpochMs,
        payload.interactionToken,
      );
      const jobPayload = {
        payload: operationPayload,
        requester,
        ...(interactionDeadlineEpochMs === undefined ? {} : { interactionDeadlineEpochMs }),
      };
      const accepted = yield* dispatchJobs
        .acceptCreation({
          dispatchRequestId: payload.dispatchRequestId,
          entityType: "dispatchCreation",
          entityId,
          operation,
          payload: jobPayload,
        })
        .pipe(Effect.mapError(normalizeDispatchError("Failed to accept dispatch job")));
      const acceptedJob = accepted.job;

      if (
        accepted.alreadyAccepted &&
        (acceptedJob.entityType !== "dispatchCreation" ||
          acceptedJob.entityId !== entityId ||
          acceptedJob.operation !== operation ||
          !hasSameDispatchJobPayload(acceptedJob, jobPayload))
      ) {
        return yield* Effect.fail(
          makeArgumentError("Dispatch request id was already used for a different job", {
            dispatchRequestId: payload.dispatchRequestId,
            entityType: acceptedJob.entityType,
            entityId: acceptedJob.entityId,
            operation: acceptedJob.operation,
          }),
        );
      }

      const enqueueJob =
        accepted.alreadyAccepted && acceptedJob.status === "failed"
          ? yield* dispatchJobs
              .retryFailedCreation({
                dispatchRequestId: payload.dispatchRequestId,
                entityId,
                operation,
                payload: jobPayload,
              })
              .pipe(Effect.mapError(normalizeDispatchError("Failed to retry dispatch job")))
          : acceptedJob;

      if (enqueueJob === null) {
        return yield* Effect.fail(
          makeArgumentError("Dispatch request id could not be retried", {
            dispatchRequestId: payload.dispatchRequestId,
            status: acceptedJob.status,
          }),
        );
      }

      if (
        accepted.alreadyAccepted &&
        acceptedJob.status === "failed" &&
        enqueueJob.status === "failed"
      ) {
        return yield* Effect.fail(
          makeArgumentError("Dispatch request id could not be retried", {
            dispatchRequestId: payload.dispatchRequestId,
            entityType: enqueueJob.entityType,
            entityId: enqueueJob.entityId,
            operation: enqueueJob.operation,
          }),
        );
      }

      if (!accepted.alreadyAccepted || enqueueJob.status === "accepted") {
        const client = creationClient(entityId);
        // Creation jobs are idempotent by dispatchRequestId. Leave enqueue failures
        // accepted so the same request id can retry without poisoning a shared row.
        // Failed creation rows are reset to accepted above before retrying enqueue.
        yield* client[operation](
          {
            dispatchRequestId: payload.dispatchRequestId,
            interactionDeadlineEpochMs,
            requester,
            payload: operationPayload,
          },
          { discard: true },
        ).pipe(Effect.mapError(normalizeDispatchError("Failed to enqueue dispatch job")));
      }

      return acceptedResult({
        dispatchRequestId: enqueueJob.dispatchRequestId,
        entityType: "dispatchCreation",
        entityId: enqueueJob.entityId,
        operation,
      });
    });

    const acceptButton = Effect.fnUntraced(function* (request: MessageDispatchRequest) {
      const { messageId, operation, payload, requester } = request;
      const interactionDeadlineEpochMs = clampInteractionDeadline(
        payload.interactionDeadlineEpochMs,
        payload.interactionToken,
      );
      const authorizedRoomOrder =
        operation === "checkinButton" ? undefined : request.authorizedRoomOrder;
      const dispatchRequestId = `button:${operation}:${messageId}:${randomUUID()}`;
      const entityId = dispatchMessageEntityId(messageId);
      const deadlineMetadata =
        interactionDeadlineEpochMs === undefined ? {} : { interactionDeadlineEpochMs };
      const jobPayload = yield* Effect.gen(function* () {
        if (operation === "checkinButton") {
          return { payload, requester, ...deadlineMetadata };
        }

        const encodedAuthorizedRoomOrder =
          authorizedRoomOrder === null
            ? null
            : yield* Schema.encodeUnknownEffect(MessageRoomOrder)(authorizedRoomOrder);
        return {
          payload,
          requester,
          ...deadlineMetadata,
          authorizedRoomOrder: encodedAuthorizedRoomOrder,
        };
      });
      yield* dispatchJobs
        .acceptButton({
          dispatchRequestId,
          entityType: "dispatchMessage",
          entityId,
          operation,
          payload: jobPayload,
        })
        .pipe(Effect.mapError(normalizeDispatchError("Failed to accept dispatch job")));

      const client = messageClient(entityId);
      const enqueue = (() => {
        switch (operation) {
          case "checkinButton":
            return client.checkinButton(
              {
                dispatchRequestId,
                interactionDeadlineEpochMs,
                requester,
                payload,
              },
              { discard: true },
            );
          case "roomOrderPreviousButton":
            return client[DispatchRoomOrderButtonMethods.previous.endpointName](
              {
                dispatchRequestId,
                interactionDeadlineEpochMs,
                requester,
                payload,
                authorizedRoomOrder: request.authorizedRoomOrder,
              },
              { discard: true },
            );
          case "roomOrderNextButton":
            return client[DispatchRoomOrderButtonMethods.next.endpointName](
              {
                dispatchRequestId,
                interactionDeadlineEpochMs,
                requester,
                payload,
                authorizedRoomOrder: request.authorizedRoomOrder,
              },
              { discard: true },
            );
          case "roomOrderSendButton":
            return client[DispatchRoomOrderButtonMethods.send.endpointName](
              {
                dispatchRequestId,
                interactionDeadlineEpochMs,
                requester,
                payload,
                authorizedRoomOrder: request.authorizedRoomOrder,
              },
              { discard: true },
            );
          case "roomOrderPinTentativeButton":
            return client[DispatchRoomOrderButtonMethods.pinTentative.endpointName](
              {
                dispatchRequestId,
                interactionDeadlineEpochMs,
                requester,
                payload,
                authorizedRoomOrder: request.authorizedRoomOrder,
              },
              { discard: true },
            );
        }
      })();
      yield* enqueue.pipe(
        Effect.tapError((error) =>
          dispatchJobs
            .markEnqueueFailed(
              dispatchRequestId,
              normalizeDispatchError("Failed to enqueue dispatch job")(error),
            )
            .pipe(Effect.ignore),
        ),
        Effect.mapError(normalizeDispatchError("Failed to enqueue dispatch job")),
      );

      return acceptedResult({
        dispatchRequestId,
        entityType: "dispatchMessage",
        entityId,
        operation,
      });
    });

    return {
      "dispatch.checkin": Effect.fnUntraced(function* ({ payload }) {
        const requester = yield* captureRequester;
        return yield* acceptCreation({ payload, requester, operation: "checkin" });
      }),
      "dispatch.checkinButton": Effect.fnUntraced(function* ({ payload }) {
        const requester = yield* captureRequester;
        yield* requireCheckinButtonAccess(payload.messageId);
        return yield* acceptButton({
          messageId: payload.messageId,
          operation: "checkinButton",
          payload,
          requester,
        });
      }),
      "dispatch.roomOrder": Effect.fnUntraced(function* ({ payload }) {
        const requester = yield* captureRequester;
        return yield* acceptCreation({ payload, requester, operation: "roomOrder" });
      }),
      [DispatchRoomOrderButtonMethods.previous.rpcTag]: Effect.fnUntraced(function* ({ payload }) {
        const requester = yield* captureRequester;
        const authorizedRoomOrder = yield* requireRegisteredRoomOrderButtonAccess(payload);
        return yield* acceptButton({
          messageId: payload.messageId,
          operation: "roomOrderPreviousButton",
          payload,
          requester,
          authorizedRoomOrder,
        });
      }),
      [DispatchRoomOrderButtonMethods.next.rpcTag]: Effect.fnUntraced(function* ({ payload }) {
        const requester = yield* captureRequester;
        const authorizedRoomOrder = yield* requireRegisteredRoomOrderButtonAccess(payload);
        return yield* acceptButton({
          messageId: payload.messageId,
          operation: "roomOrderNextButton",
          payload,
          requester,
          authorizedRoomOrder,
        });
      }),
      [DispatchRoomOrderButtonMethods.send.rpcTag]: Effect.fnUntraced(function* ({ payload }) {
        const requester = yield* captureRequester;
        const authorizedRoomOrder = yield* requireRegisteredRoomOrderButtonAccess(payload);
        return yield* acceptButton({
          messageId: payload.messageId,
          operation: "roomOrderSendButton",
          payload,
          requester,
          authorizedRoomOrder,
        });
      }),
      [DispatchRoomOrderButtonMethods.pinTentative.rpcTag]: Effect.fnUntraced(function* ({
        payload,
      }) {
        const requester = yield* captureRequester;
        const authorizedRoomOrder = yield* requireRoomOrderPinTentativeButtonAccess(payload);
        return yield* acceptButton({
          messageId: payload.messageId,
          operation: "roomOrderPinTentativeButton",
          payload,
          requester,
          authorizedRoomOrder,
        });
      }),
    };
  }),
).pipe(Layer.provide(DispatchJobs.layer));
