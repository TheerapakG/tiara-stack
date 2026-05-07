import { Clock, Duration, Effect, Fiber, Layer, Schedule, Schema } from "effect";
import { ClusterSchema, Entity } from "effect/unstable/cluster";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import {
  CheckinDispatchError,
  CheckinDispatchPayload,
  CheckinDispatchResult,
  CheckinHandleButtonError,
  CheckinHandleButtonPayload,
  CheckinHandleButtonResult,
  DispatchRoomOrderButtonMethods,
  interactionTokenExpirySafetyMarginMs,
  interactionTokenLifetimeMs,
  RoomOrderDispatchError,
  RoomOrderDispatchPayload,
  RoomOrderDispatchResult,
  RoomOrderHandleButtonError,
  RoomOrderNextButtonPayload,
  RoomOrderNextButtonResult,
  RoomOrderPinTentativeButtonPayload,
  RoomOrderPinTentativeButtonResult,
  RoomOrderPreviousButtonPayload,
  RoomOrderPreviousButtonResult,
  RoomOrderSendButtonPayload,
  RoomOrderSendButtonResult,
} from "sheet-ingress-api/sheet-apis-rpc";
import { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import { makeArgumentError } from "typhoon-core/error";
import { normalizeDispatchError } from "@/handlers/shared/dispatchError";
import {
  DispatchJobs,
  DispatchService,
  IngressBotClient,
  type DispatchJob,
  type DispatchOperation,
  type DispatchJobRunClaim,
  type DispatchRequester,
} from "@/services";

export const DispatchRequesterSchema = Schema.Struct({
  accountId: Schema.String,
  userId: Schema.String,
});

export type DispatchCreationOperation = "checkin" | "roomOrder";
export type DispatchMessageOperation =
  | "checkinButton"
  | "roomOrderPreviousButton"
  | "roomOrderNextButton"
  | "roomOrderSendButton"
  | "roomOrderPinTentativeButton";

type DispatchEntityRequest<Payload, Extra extends object = {}> = {
  readonly dispatchRequestId: string;
  readonly interactionDeadlineEpochMs?: number;
  readonly requester: DispatchRequester;
  readonly payload: Payload;
} & Extra;

type DispatchEntityEnvelope<Payload, Extra extends object = {}> = {
  readonly payload: DispatchEntityRequest<Payload, Extra>;
};

type DispatchEntityHandler<Payload, Extra extends object = {}> = (
  envelope: DispatchEntityEnvelope<Payload, Extra>,
) => Effect.Effect<unknown, unknown, unknown>;

const dispatchEntityRequest = <Payload, Extra extends object = {}>(
  envelope: DispatchEntityEnvelope<Payload, Extra>,
) => envelope.payload;

const asDispatchCreationHandlers = (handlers: {
  readonly checkin: DispatchEntityHandler<CheckinDispatchPayload>;
  readonly roomOrder: DispatchEntityHandler<RoomOrderDispatchPayload>;
}) => handlers as Parameters<typeof DispatchCreationEntity.of>[0];

const asDispatchMessageHandlers = (handlers: {
  readonly checkinButton: DispatchEntityHandler<CheckinHandleButtonPayload>;
  readonly roomOrderPreviousButton: DispatchEntityHandler<
    RoomOrderPreviousButtonPayload,
    { readonly authorizedRoomOrder: MessageRoomOrder }
  >;
  readonly roomOrderNextButton: DispatchEntityHandler<
    RoomOrderNextButtonPayload,
    { readonly authorizedRoomOrder: MessageRoomOrder }
  >;
  readonly roomOrderSendButton: DispatchEntityHandler<
    RoomOrderSendButtonPayload,
    { readonly authorizedRoomOrder: MessageRoomOrder }
  >;
  readonly roomOrderPinTentativeButton: DispatchEntityHandler<
    RoomOrderPinTentativeButtonPayload,
    { readonly authorizedRoomOrder?: MessageRoomOrder | null }
  >;
}) => handlers as Parameters<typeof DispatchMessageEntity.of>[0];

const assertNever = (value: never): never => {
  throw new Error(`Unexpected dispatch operation: ${String(value)}`);
};

const creationPayload = <Payload extends Schema.Top>(payload: Payload) =>
  Schema.Struct({
    dispatchRequestId: Schema.String,
    interactionDeadlineEpochMs: Schema.optional(Schema.Number),
    requester: DispatchRequesterSchema,
    payload,
  });

const fireAndForgetSuccess = <Success extends Schema.Top>(success: Success) =>
  Schema.Union([success, Schema.Void]);

const CheckinDispatchEntityResult = fireAndForgetSuccess(CheckinDispatchResult);
const RoomOrderDispatchEntityResult = fireAndForgetSuccess(RoomOrderDispatchResult);
const CheckinHandleButtonEntityResult = fireAndForgetSuccess(CheckinHandleButtonResult);
const RoomOrderPreviousButtonEntityResult = fireAndForgetSuccess(RoomOrderPreviousButtonResult);
const RoomOrderNextButtonEntityResult = fireAndForgetSuccess(RoomOrderNextButtonResult);
const RoomOrderSendButtonEntityResult = fireAndForgetSuccess(RoomOrderSendButtonResult);
const RoomOrderPinTentativeButtonEntityResult = fireAndForgetSuccess(
  RoomOrderPinTentativeButtonResult,
);

export const DispatchCreationRpcs = RpcGroup.make(
  Rpc.make("checkin", {
    payload: creationPayload(CheckinDispatchPayload),
    success: CheckinDispatchEntityResult,
    error: CheckinDispatchError,
  }),
  Rpc.make("roomOrder", {
    payload: creationPayload(RoomOrderDispatchPayload),
    success: RoomOrderDispatchEntityResult,
    error: RoomOrderDispatchError,
  }),
);

export const DispatchCreationEntity = Entity.fromRpcGroup(
  "sheetApis.dispatchCreation",
  DispatchCreationRpcs,
)
  .annotate(ClusterSchema.ShardGroup, () => "dispatch")
  .annotateRpcs(ClusterSchema.Persisted, true);

const messagePayload = <Payload extends Schema.Top>(payload: Payload) =>
  Schema.Struct({
    dispatchRequestId: Schema.String,
    interactionDeadlineEpochMs: Schema.optional(Schema.Number),
    requester: DispatchRequesterSchema,
    payload,
  });

const storedPayload = <Payload extends Schema.Top>(payload: Payload) =>
  Schema.Struct({
    interactionDeadlineEpochMs: Schema.optional(Schema.Number),
    requester: DispatchRequesterSchema,
    payload,
  });

const roomOrderMessagePayload = <Payload extends Schema.Top>(payload: Payload) =>
  Schema.Struct({
    dispatchRequestId: Schema.String,
    interactionDeadlineEpochMs: Schema.optional(Schema.Number),
    requester: DispatchRequesterSchema,
    payload,
    authorizedRoomOrder: MessageRoomOrder,
  });

const roomOrderStoredPayload = <Payload extends Schema.Top>(payload: Payload) =>
  Schema.Struct({
    interactionDeadlineEpochMs: Schema.optional(Schema.Number),
    requester: DispatchRequesterSchema,
    payload,
    authorizedRoomOrder: MessageRoomOrder,
  });

const roomOrderPinTentativeMessagePayload = Schema.Struct({
  dispatchRequestId: Schema.String,
  interactionDeadlineEpochMs: Schema.optional(Schema.Number),
  requester: DispatchRequesterSchema,
  payload: RoomOrderPinTentativeButtonPayload,
  authorizedRoomOrder: Schema.optional(Schema.NullOr(MessageRoomOrder)),
});

const roomOrderPinTentativeStoredPayload = Schema.Struct({
  interactionDeadlineEpochMs: Schema.optional(Schema.Number),
  requester: DispatchRequesterSchema,
  payload: RoomOrderPinTentativeButtonPayload,
  authorizedRoomOrder: Schema.optional(Schema.NullOr(MessageRoomOrder)),
});

const decodeRoomOrderStoredPayload =
  <Payload extends Schema.Top>(schema: Payload) =>
  (payload: unknown) =>
    Schema.decodeUnknownEffect(roomOrderStoredPayload(schema))(payload);

export const decodeRoomOrderPinTentativeStoredPayload = (payload: unknown) =>
  Schema.decodeUnknownEffect(roomOrderPinTentativeStoredPayload)(payload);

export const DispatchMessageRpcs = RpcGroup.make(
  Rpc.make("checkinButton", {
    payload: messagePayload(CheckinHandleButtonPayload),
    success: CheckinHandleButtonEntityResult,
    error: CheckinHandleButtonError,
  }),
  Rpc.make(DispatchRoomOrderButtonMethods.previous.endpointName, {
    payload: roomOrderMessagePayload(RoomOrderPreviousButtonPayload),
    success: RoomOrderPreviousButtonEntityResult,
    error: RoomOrderHandleButtonError,
  }),
  Rpc.make(DispatchRoomOrderButtonMethods.next.endpointName, {
    payload: roomOrderMessagePayload(RoomOrderNextButtonPayload),
    success: RoomOrderNextButtonEntityResult,
    error: RoomOrderHandleButtonError,
  }),
  Rpc.make(DispatchRoomOrderButtonMethods.send.endpointName, {
    payload: roomOrderMessagePayload(RoomOrderSendButtonPayload),
    success: RoomOrderSendButtonEntityResult,
    error: RoomOrderHandleButtonError,
  }),
  Rpc.make(DispatchRoomOrderButtonMethods.pinTentative.endpointName, {
    payload: roomOrderPinTentativeMessagePayload,
    success: RoomOrderPinTentativeButtonEntityResult,
    error: RoomOrderHandleButtonError,
  }),
);

export const DispatchMessageEntity = Entity.fromRpcGroup(
  "sheetApis.dispatchMessage",
  DispatchMessageRpcs,
)
  .annotate(ClusterSchema.ShardGroup, () => "dispatch")
  .annotateRpcs(ClusterSchema.Persisted, true);

export const dispatchCreationEntityId = (guildId: string): string => `guild:${guildId}`;

export const dispatchMessageEntityId = (messageId: string): string => `message:${messageId}`;

const entityFailureMessage = "Dispatch failed. Please try again.";
const entityTimeoutMessage = "Dispatch is still running. Please try again if this does not finish.";
const defaultAlreadyRunningPollInterval = Duration.seconds(5);
const defaultAlreadyRunningMaxRetries = 25;
const dispatchJobRecoveryInterval = Duration.seconds(30);
const staleFailureNotificationPollInterval = Duration.seconds(5);

type ReplacementJobLookup =
  | {
      readonly _tag: "found";
      readonly job: DispatchJob;
    }
  | {
      readonly _tag: "missing";
    }
  | {
      readonly _tag: "readFailed";
    };

const notifyInteractionFailure = (interactionToken: string | undefined) =>
  typeof interactionToken === "string"
    ? Effect.gen(function* () {
        const botClient = yield* IngressBotClient;
        yield* botClient
          .updateOriginalInteractionResponse(interactionToken, { content: entityFailureMessage })
          .pipe(Effect.catch(() => Effect.void));
      })
    : Effect.void;

const notifyInteractionTimeout = (interactionToken: string | undefined) =>
  typeof interactionToken === "string"
    ? Effect.gen(function* () {
        const botClient = yield* IngressBotClient;
        yield* botClient
          .updateOriginalInteractionResponse(interactionToken, { content: entityTimeoutMessage })
          .pipe(Effect.catch(() => Effect.void));
      })
    : Effect.void;

const notifyIfReplacementFailsOrInteractionNearsExpiry = ({
  dispatchRequestId,
  interactionDeadlineMs,
  interactionToken,
}: {
  readonly dispatchRequestId: string;
  readonly interactionDeadlineMs: number;
  readonly interactionToken: string | undefined;
}) =>
  typeof interactionToken === "string"
    ? Effect.gen(function* () {
        const jobs = yield* DispatchJobs;
        const inspectReplacement = jobs.get(dispatchRequestId).pipe(
          Effect.map(
            (job): ReplacementJobLookup =>
              job === null ? { _tag: "missing" } : { _tag: "found", job },
          ),
          Effect.catch((error) =>
            Effect.logWarning("Failed to inspect stale dispatch job replacement", {
              dispatchRequestId,
              error,
            }).pipe(Effect.as({ _tag: "readFailed" as const })),
          ),
        );

        while (true) {
          const replacement = yield* inspectReplacement;
          switch (replacement._tag) {
            case "found":
              if (replacement.job.status === "failed") {
                yield* notifyInteractionFailure(interactionToken);
                return;
              }
              if (replacement.job.status === "succeeded") {
                return;
              }
              break;
            case "missing":
              return;
            case "readFailed":
              break;
          }
          const now = yield* Clock.currentTimeMillis;

          if (now >= interactionDeadlineMs) {
            yield* notifyInteractionTimeout(interactionToken);
            return;
          }
          yield* Effect.sleep(staleFailureNotificationPollInterval);
        }
      }).pipe(Effect.catch(() => Effect.void))
    : Effect.void;

const decodeStoredResult = <Success extends Schema.Top>({
  dispatchRequestId,
  result,
  schema,
}: {
  readonly dispatchRequestId: string;
  readonly result: unknown;
  readonly schema: Success;
}) =>
  Schema.decodeUnknownEffect(schema)(result).pipe(
    Effect.mapError((error) =>
      makeArgumentError("Stored dispatch job result failed schema validation", {
        dispatchRequestId,
        error,
      }),
    ),
  );

export const runTracked = <Success extends Schema.Top, E, R>({
  alreadyRunningMaxRetries = defaultAlreadyRunningMaxRetries,
  alreadyRunningPollInterval = defaultAlreadyRunningPollInterval,
  dispatchRequestId,
  effect,
  interactionDeadlineEpochMs,
  interactionToken,
  successSchema,
}: {
  readonly alreadyRunningMaxRetries?: number;
  readonly alreadyRunningPollInterval?: Duration.Input;
  readonly dispatchRequestId: string;
  readonly interactionDeadlineEpochMs?: number;
  readonly interactionToken?: string;
  readonly effect: Effect.Effect<Success["Type"], E, R>;
  readonly successSchema: Success;
}) =>
  Effect.gen(function* () {
    const jobs = yield* DispatchJobs;

    type ClaimedJob = Extract<DispatchJobRunClaim, { readonly _tag: "claimed" }>;
    type ClaimResult =
      | ClaimedJob
      | {
          readonly _tag: "storedResult";
          readonly result: Success["Type"];
        }
      | {
          readonly _tag: "storedFailure";
        }
      | {
          readonly _tag: "stillOwned";
        };

    const claimRunning = Effect.fn("DispatchEntity.claimRunning")(function* () {
      for (let retries = 0; ; retries++) {
        const claim = yield* jobs.claimRunning(dispatchRequestId);
        switch (claim._tag) {
          case "claimed":
            return claim;
          case "alreadySucceeded":
            return yield* decodeStoredResult({
              dispatchRequestId,
              result: claim.job.result,
              schema: successSchema,
            }).pipe(
              Effect.map(
                (result) =>
                  ({
                    _tag: "storedResult",
                    result,
                  }) satisfies ClaimResult,
              ),
              Effect.catch((error) =>
                Effect.logWarning("Skipping invalid stored dispatch job result redelivery", {
                  dispatchRequestId,
                  entityId: claim.job.entityId,
                  operation: claim.job.operation,
                  error,
                }).pipe(
                  Effect.as({
                    _tag: "storedFailure",
                  } satisfies ClaimResult),
                ),
              ),
            );
          case "alreadyRunning":
            break;
          case "alreadyFailed":
            yield* Effect.logWarning("Skipping already failed dispatch job redelivery", {
              dispatchRequestId,
              entityId: claim.job.entityId,
              operation: claim.job.operation,
              error: claim.job.error,
            });
            return {
              _tag: "storedFailure",
            } satisfies ClaimResult;
        }

        if (retries >= alreadyRunningMaxRetries) {
          yield* Effect.logWarning("Skipping dispatch job redelivery still owned by another run", {
            dispatchRequestId,
            entityId: claim.job.entityId,
            operation: claim.job.operation,
            runId: claim.job.runId,
          });
          return {
            _tag: "stillOwned",
          } satisfies ClaimResult;
        }

        yield* Effect.sleep(alreadyRunningPollInterval);
      }

      return yield* Effect.die(`Dispatch job ${dispatchRequestId} claim loop exited unexpectedly`);
    });

    const claim = (yield* claimRunning()) as ClaimResult;
    switch (claim._tag) {
      case "storedResult":
        return claim.result;
      case "storedFailure":
        // Entity RPCs are enqueued with discard responses. Returning cleanly here
        // acknowledges persisted redeliveries for permanently failed jobs instead
        // of surfacing a typed failure that cluster storage may retry forever.
        return undefined as Success["Type"];
      case "stillOwned":
        // The active run still owns the database job. Acknowledging this redelivery
        // frees the entity mailbox; dispatchJobRecoveryLayer re-enqueues stale rows
        // if the owner later stops heartbeating before reaching a terminal state.
        return undefined as Success["Type"];
      case "claimed":
        break;
    }

    const heartbeat = yield* jobs.heartbeatRunning(dispatchRequestId, claim.runId).pipe(
      Effect.catch(() => Effect.void),
      Effect.repeat(Schedule.spaced(Duration.seconds(30))),
      Effect.forkDetach,
    );
    const exit = yield* Effect.exit(effect).pipe(Effect.ensuring(Fiber.interrupt(heartbeat)));
    if (exit._tag === "Success") {
      yield* jobs.markSucceeded(dispatchRequestId, claim.runId, exit.value).pipe(
        Effect.catchTag("DispatchJobTerminalUpdateRejectedError", (error) =>
          Effect.logWarning("Acknowledging stale dispatch job success", {
            dispatchRequestId,
            runId: claim.runId,
            currentRunId: error.currentRunId,
            currentStatus: error.currentStatus,
          }),
        ),
      );
      return exit.value;
    }
    const failureUpdate = yield* jobs
      .markFailed(dispatchRequestId, claim.runId, {
        _tag: "DispatchExecutionFailure",
        cause: String(exit.cause),
      })
      .pipe(
        Effect.as("markedFailed" as const),
        Effect.catchTag("DispatchJobTerminalUpdateRejectedError", (error) =>
          Effect.logWarning("Acknowledging stale dispatch job failure", {
            dispatchRequestId,
            runId: claim.runId,
            currentRunId: error.currentRunId,
            currentStatus: error.currentStatus,
          }).pipe(
            Effect.as(
              error.currentStatus === "accepted" || error.currentStatus === "running"
                ? ("watchCurrentRun" as const)
                : "stale",
            ),
          ),
        ),
      );
    if (failureUpdate === "watchCurrentRun") {
      yield* notifyIfReplacementFailsOrInteractionNearsExpiry({
        dispatchRequestId,
        interactionDeadlineMs:
          interactionDeadlineEpochMs ??
          claim.job.createdAt.getTime() +
            interactionTokenLifetimeMs -
            interactionTokenExpirySafetyMarginMs,
        interactionToken,
      }).pipe(Effect.forkDetach);
      return undefined as Success["Type"];
    }
    if (failureUpdate === "stale") {
      return undefined as Success["Type"];
    }
    yield* notifyInteractionFailure(interactionToken);
    return yield* Effect.failCause(exit.cause);
  });

const dispatchJobRecoveryLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const jobs = yield* DispatchJobs;
    const creationClient = yield* DispatchCreationEntity.client;
    const messageClient = yield* DispatchMessageEntity.client;

    const decodeStoredPayload = <Payload extends Schema.Top>(job: DispatchJob, schema: Payload) =>
      Schema.decodeUnknownEffect(storedPayload(schema))(job.payload);

    const withRecoveredDispatchMetadata = <
      Request extends {
        readonly interactionDeadlineEpochMs?: number;
        readonly payload: { readonly interactionDeadlineEpochMs?: number };
      },
    >(
      job: DispatchJob,
      request: Request,
    ) => ({
      ...request,
      dispatchRequestId: job.dispatchRequestId,
      interactionDeadlineEpochMs:
        request.interactionDeadlineEpochMs ?? request.payload.interactionDeadlineEpochMs,
    });

    const requireEntityType = (job: DispatchJob, entityType: DispatchJob["entityType"]) =>
      job.entityType === entityType
        ? Effect.void
        : Effect.fail(
            makeArgumentError("Recovered dispatch job entity type did not match operation", {
              dispatchRequestId: job.dispatchRequestId,
              entityType: job.entityType,
              expectedEntityType: entityType,
              operation: job.operation,
            }),
          );

    const enqueueRecovered = Effect.fn("DispatchEntity.enqueueRecovered")(function* (
      job: DispatchJob,
    ) {
      const operation: DispatchOperation = job.operation;
      switch (operation) {
        case "checkin": {
          yield* requireEntityType(job, "dispatchCreation");
          const client = creationClient(job.entityId);
          const request = yield* decodeStoredPayload(job, CheckinDispatchPayload);
          yield* client.checkin(withRecoveredDispatchMetadata(job, request), { discard: true });
          return;
        }
        case "roomOrder": {
          yield* requireEntityType(job, "dispatchCreation");
          const client = creationClient(job.entityId);
          const request = yield* decodeStoredPayload(job, RoomOrderDispatchPayload);
          yield* client.roomOrder(withRecoveredDispatchMetadata(job, request), { discard: true });
          return;
        }
        case "checkinButton": {
          yield* requireEntityType(job, "dispatchMessage");
          const client = messageClient(job.entityId);
          const request = yield* decodeStoredPayload(job, CheckinHandleButtonPayload);
          yield* client.checkinButton(withRecoveredDispatchMetadata(job, request), {
            discard: true,
          });
          return;
        }
        case "roomOrderPreviousButton": {
          yield* requireEntityType(job, "dispatchMessage");
          const client = messageClient(job.entityId);
          const request = yield* decodeRoomOrderStoredPayload(RoomOrderPreviousButtonPayload)(
            job.payload,
          );
          yield* client[DispatchRoomOrderButtonMethods.previous.endpointName](
            withRecoveredDispatchMetadata(job, request),
            { discard: true },
          );
          return;
        }
        case "roomOrderNextButton": {
          yield* requireEntityType(job, "dispatchMessage");
          const client = messageClient(job.entityId);
          const request = yield* decodeRoomOrderStoredPayload(RoomOrderNextButtonPayload)(
            job.payload,
          );
          yield* client[DispatchRoomOrderButtonMethods.next.endpointName](
            withRecoveredDispatchMetadata(job, request),
            { discard: true },
          );
          return;
        }
        case "roomOrderSendButton": {
          yield* requireEntityType(job, "dispatchMessage");
          const client = messageClient(job.entityId);
          const request = yield* decodeRoomOrderStoredPayload(RoomOrderSendButtonPayload)(
            job.payload,
          );
          yield* client[DispatchRoomOrderButtonMethods.send.endpointName](
            withRecoveredDispatchMetadata(job, request),
            { discard: true },
          );
          return;
        }
        case "roomOrderPinTentativeButton": {
          yield* requireEntityType(job, "dispatchMessage");
          const client = messageClient(job.entityId);
          const request = yield* decodeRoomOrderPinTentativeStoredPayload(job.payload);
          yield* client[DispatchRoomOrderButtonMethods.pinTentative.endpointName](
            withRecoveredDispatchMetadata(job, request),
            { discard: true },
          );
          return;
        }
      }

      return assertNever(operation);
    });

    const recover = jobs.recoverRunnable().pipe(
      Effect.flatMap((recoveredJobs) =>
        Effect.forEach(
          recoveredJobs,
          (job) =>
            enqueueRecovered(job).pipe(
              Effect.catch((error) =>
                Effect.logWarning("Failed to re-enqueue recovered dispatch job", {
                  dispatchRequestId: job.dispatchRequestId,
                  entityType: job.entityType,
                  entityId: job.entityId,
                  operation: job.operation,
                  error,
                }),
              ),
            ),
          { concurrency: 10, discard: true },
        ),
      ),
      Effect.catch((error) =>
        Effect.logWarning("Failed to recover runnable dispatch jobs", { error }),
      ),
    );

    yield* recover.pipe(
      Effect.repeat(Schedule.spaced(dispatchJobRecoveryInterval)),
      Effect.forkScoped,
    );
  }),
);

export const dispatchEntitiesLayer = Layer.mergeAll(
  DispatchCreationEntity.toLayer(
    Effect.gen(function* () {
      const dispatchService = yield* DispatchService;
      const dispatchJobs = yield* DispatchJobs;
      const ingressBotClient = yield* IngressBotClient;
      const provideTrackingServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        effect.pipe(
          Effect.provideService(DispatchJobs, dispatchJobs),
          Effect.provideService(IngressBotClient, ingressBotClient),
        );

      return DispatchCreationEntity.of(
        asDispatchCreationHandlers({
          checkin: (envelope) => {
            const request = dispatchEntityRequest<CheckinDispatchPayload>(envelope);
            return provideTrackingServices(
              runTracked({
                dispatchRequestId: request.dispatchRequestId,
                interactionToken: request.payload.interactionToken,
                interactionDeadlineEpochMs: request.interactionDeadlineEpochMs,
                successSchema: CheckinDispatchEntityResult,
                effect: dispatchService
                  .checkin(request.payload, request.requester)
                  .pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch check-in"))),
              }),
            );
          },
          roomOrder: (envelope) => {
            const request = dispatchEntityRequest<RoomOrderDispatchPayload>(envelope);
            return provideTrackingServices(
              runTracked({
                dispatchRequestId: request.dispatchRequestId,
                interactionToken: request.payload.interactionToken,
                interactionDeadlineEpochMs: request.interactionDeadlineEpochMs,
                successSchema: RoomOrderDispatchEntityResult,
                effect: dispatchService
                  .roomOrder(request.payload, request.requester)
                  .pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch room order"))),
              }),
            );
          },
        }),
      );
    }),
    {
      concurrency: 1,
      mailboxCapacity: 1024,
      maxIdleTime: Duration.minutes(2),
      spanAttributes: { entity: "dispatchCreation" },
    },
  ),
  DispatchMessageEntity.toLayer(
    Effect.gen(function* () {
      const dispatchService = yield* DispatchService;
      const dispatchJobs = yield* DispatchJobs;
      const ingressBotClient = yield* IngressBotClient;
      const provideTrackingServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        effect.pipe(
          Effect.provideService(DispatchJobs, dispatchJobs),
          Effect.provideService(IngressBotClient, ingressBotClient),
        );

      return DispatchMessageEntity.of(
        asDispatchMessageHandlers({
          checkinButton: (envelope) => {
            const request = dispatchEntityRequest<CheckinHandleButtonPayload>(envelope);
            return provideTrackingServices(
              runTracked({
                dispatchRequestId: request.dispatchRequestId,
                interactionToken: request.payload.interactionToken,
                interactionDeadlineEpochMs: request.interactionDeadlineEpochMs,
                successSchema: CheckinHandleButtonEntityResult,
                effect: dispatchService
                  .checkinButton(request.payload, request.requester)
                  .pipe(
                    Effect.mapError(normalizeDispatchError("Failed to handle check-in button")),
                  ),
              }),
            );
          },
          [DispatchRoomOrderButtonMethods.previous.endpointName]: (envelope) => {
            const request = dispatchEntityRequest<
              RoomOrderPreviousButtonPayload,
              { readonly authorizedRoomOrder: MessageRoomOrder }
            >(envelope);
            return provideTrackingServices(
              runTracked({
                dispatchRequestId: request.dispatchRequestId,
                interactionToken: request.payload.interactionToken,
                interactionDeadlineEpochMs: request.interactionDeadlineEpochMs,
                successSchema: RoomOrderPreviousButtonEntityResult,
                effect: dispatchService
                  .roomOrderPreviousButton(request.payload, request.authorizedRoomOrder)
                  .pipe(
                    Effect.mapError(normalizeDispatchError("Failed to handle room-order button")),
                  ),
              }),
            );
          },
          [DispatchRoomOrderButtonMethods.next.endpointName]: (envelope) => {
            const request = dispatchEntityRequest<
              RoomOrderNextButtonPayload,
              { readonly authorizedRoomOrder: MessageRoomOrder }
            >(envelope);
            return provideTrackingServices(
              runTracked({
                dispatchRequestId: request.dispatchRequestId,
                interactionToken: request.payload.interactionToken,
                interactionDeadlineEpochMs: request.interactionDeadlineEpochMs,
                successSchema: RoomOrderNextButtonEntityResult,
                effect: dispatchService
                  .roomOrderNextButton(request.payload, request.authorizedRoomOrder)
                  .pipe(
                    Effect.mapError(normalizeDispatchError("Failed to handle room-order button")),
                  ),
              }),
            );
          },
          [DispatchRoomOrderButtonMethods.send.endpointName]: (envelope) => {
            const request = dispatchEntityRequest<
              RoomOrderSendButtonPayload,
              { readonly authorizedRoomOrder: MessageRoomOrder }
            >(envelope);
            return provideTrackingServices(
              runTracked({
                dispatchRequestId: request.dispatchRequestId,
                interactionToken: request.payload.interactionToken,
                interactionDeadlineEpochMs: request.interactionDeadlineEpochMs,
                successSchema: RoomOrderSendButtonEntityResult,
                effect: dispatchService
                  .roomOrderSendButton(request.payload, request.authorizedRoomOrder)
                  .pipe(
                    Effect.mapError(normalizeDispatchError("Failed to handle room-order button")),
                  ),
              }),
            );
          },
          [DispatchRoomOrderButtonMethods.pinTentative.endpointName]: (envelope) => {
            const request = dispatchEntityRequest<
              RoomOrderPinTentativeButtonPayload,
              { readonly authorizedRoomOrder?: MessageRoomOrder | null }
            >(envelope);
            return provideTrackingServices(
              runTracked({
                dispatchRequestId: request.dispatchRequestId,
                interactionToken: request.payload.interactionToken,
                interactionDeadlineEpochMs: request.interactionDeadlineEpochMs,
                successSchema: RoomOrderPinTentativeButtonEntityResult,
                effect: dispatchService
                  .roomOrderPinTentativeButton(request.payload, request.authorizedRoomOrder)
                  .pipe(
                    Effect.mapError(normalizeDispatchError("Failed to handle room-order button")),
                  ),
              }),
            );
          },
        }),
      );
    }),
    {
      concurrency: 1,
      mailboxCapacity: 2048,
      maxIdleTime: Duration.minutes(5),
      spanAttributes: { entity: "dispatchMessage" },
    },
  ),
  dispatchJobRecoveryLayer,
).pipe(Layer.provide([DispatchJobs.layer, DispatchService.layer, IngressBotClient.layer]));
