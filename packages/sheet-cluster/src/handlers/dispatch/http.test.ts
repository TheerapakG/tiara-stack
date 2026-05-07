import { describe, expect, it } from "@effect/vitest";
import { Effect, HashSet, Layer, Option, Redacted, Ref, Stream } from "effect";
import { Sharding } from "effect/unstable/cluster";
import { RpcMiddleware, RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";
import { SheetApisRpcAuthorization } from "sheet-ingress-api/middlewares/sheetApisRpcAuthorization/tag";
import type {
  CheckinDispatchPayload,
  CheckinHandleButtonPayload,
  RoomOrderPinTentativeButtonPayload,
  RoomOrderPreviousButtonPayload,
} from "sheet-ingress-api/sheet-apis-rpc";
import {
  DispatchRoomOrderButtonMethods,
  DispatchRpcs,
  MESSAGE_ROOM_ORDER_NOT_REGISTERED_ERROR_MESSAGE,
} from "sheet-ingress-api/sheet-apis-rpc";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import type { Permission, PermissionSet } from "sheet-ingress-api/schemas/permissions";
import { makeArgumentError, Unauthorized } from "typhoon-core/error";
import { SheetApisClient, type DispatchJob, type DispatchJobStatus } from "@/services";
import { dispatchLayer } from "./http";

const requester = {
  accountId: "account-1",
  userId: "user-1",
};

type TestAuthUser = {
  readonly accountId: string;
  readonly userId: string;
  readonly permissions: PermissionSet;
  readonly token: Redacted.Redacted<string>;
};

const sheetAuthUser: TestAuthUser = {
  ...requester,
  permissions: HashSet.empty(),
  token: Redacted.make("session-token"),
};

const monitorSheetAuthUser: TestAuthUser = {
  ...sheetAuthUser,
  permissions: HashSet.fromIterable(["monitor_guild:guild-1" as Permission]),
};

const payload: CheckinDispatchPayload = {
  dispatchRequestId: "dispatch-1",
  guildId: "guild-1",
  channelId: "channel-1",
  interactionDeadlineEpochMs: Date.now() + 60_000,
};

const checkinButtonPayload: CheckinHandleButtonPayload = {
  messageId: "message-1",
  interactionToken: "interaction-token",
  interactionDeadlineEpochMs: Date.now() + 60_000,
};

const roomOrderButtonPayload: RoomOrderPreviousButtonPayload = {
  guildId: "guild-1",
  messageId: "message-1",
  messageChannelId: "channel-1",
  interactionToken: "interaction-token",
  interactionDeadlineEpochMs: Date.now() + 60_000,
};

const roomOrderPinTentativeButtonPayload: RoomOrderPinTentativeButtonPayload = {
  ...roomOrderButtonPayload,
};

const storedCreationPayload = (current: CheckinDispatchPayload) => {
  const { interactionDeadlineEpochMs, ...operationPayload } = current;
  return { payload: operationPayload, requester, interactionDeadlineEpochMs };
};

const makeFailedJob = (jobPayload: unknown): DispatchJob => ({
  dispatchRequestId: "dispatch-1",
  entityType: "dispatchCreation",
  entityId: "guild:guild-1",
  operation: "checkin",
  status: "failed",
  runId: null,
  payload: jobPayload,
  result: null,
  error: { enqueue: "failed" },
  createdAt: new Date(0),
});

const makeRoomOrder = (guildId: string) =>
  new MessageRoomOrder({
    messageId: "message-1",
    hour: 20,
    previousFills: [],
    fills: [],
    rank: 0,
    tentative: true,
    monitor: Option.none(),
    guildId: Option.some(guildId),
    messageChannelId: Option.some("channel-1"),
    createdByUserId: Option.none(),
    sendClaimId: Option.none(),
    sendClaimedAt: Option.none(),
    sentMessageId: Option.none(),
    sentMessageChannelId: Option.none(),
    sentAt: Option.none(),
    tentativeUpdateClaimId: Option.none(),
    tentativeUpdateClaimedAt: Option.none(),
    tentativePinClaimId: Option.none(),
    tentativePinClaimedAt: Option.none(),
    tentativePinnedAt: Option.none(),
    createdAt: Option.none(),
    updatedAt: Option.none(),
    deletedAt: Option.none(),
  });

type StoredJob = {
  dispatch_request_id: string;
  entity_type: DispatchJob["entityType"];
  entity_id: string;
  operation: DispatchJob["operation"];
  status: DispatchJobStatus;
  run_id: string | null;
  payload: unknown;
  result: unknown;
  error: unknown;
  created_at: Date;
};

const makeSqlClient = ({
  job,
  retryAttemptCount,
  retryCount,
  acceptedPayloads,
}: {
  readonly job: Ref.Ref<DispatchJob>;
  readonly retryAttemptCount: Ref.Ref<number>;
  readonly retryCount: Ref.Ref<number>;
  readonly acceptedPayloads?: Ref.Ref<ReadonlyArray<unknown>>;
}) => {
  const migrations = new Set<string>();

  const asReturnedRow = (current: DispatchJob): StoredJob => ({
    dispatch_request_id: current.dispatchRequestId,
    entity_type: current.entityType,
    entity_id: current.entityId,
    operation: current.operation,
    status: current.status,
    run_id: current.runId,
    payload: current.payload,
    result: current.result,
    error: current.error,
    created_at: current.createdAt,
  });

  const sqlFn = (strings: TemplateStringsArray, ...params: ReadonlyArray<unknown>) =>
    Effect.gen(function* () {
      const statement = strings.join("?");
      if (
        statement.includes("pg_advisory_xact_lock") ||
        statement.includes("CREATE TABLE IF NOT EXISTS sheet_cluster_migrations") ||
        statement.includes("CREATE TABLE IF NOT EXISTS sheet_apis_dispatch_jobs") ||
        statement.includes("ALTER TABLE sheet_apis_dispatch_jobs") ||
        statement.includes(
          "CREATE INDEX IF NOT EXISTS sheet_apis_dispatch_jobs_status_updated_at_idx",
        )
      ) {
        return [];
      }

      if (statement.includes("FROM sheet_cluster_migrations")) {
        return params
          .map(String)
          .filter((name) => migrations.has(name))
          .map((name) => ({ name }));
      }

      if (statement.includes("INSERT INTO sheet_cluster_migrations")) {
        migrations.add(String(params[0]));
        return [];
      }

      if (statement.includes("INSERT INTO sheet_apis_dispatch_jobs")) {
        const dispatchRequestId = String(params[0]);
        if (dispatchRequestId === "dispatch-1") {
          return [];
        }
        const payload = JSON.parse(String(params[4]));
        if (acceptedPayloads) {
          yield* Ref.update(acceptedPayloads, (payloads) => [...payloads, payload]);
        }
        return [
          {
            dispatch_request_id: dispatchRequestId,
            entity_type: params[1] as DispatchJob["entityType"],
            entity_id: String(params[2]),
            operation: params[3] as DispatchJob["operation"],
            status: "accepted" as const,
            run_id: null,
            payload,
            result: null,
            error: null,
            created_at: new Date(0),
          },
        ];
      }

      if (statement.includes("SELECT dispatch_request_id")) {
        const current = yield* Ref.get(job);
        return current.dispatchRequestId === params[0] ? [asReturnedRow(current)] : [];
      }

      if (statement.includes("SET status = 'accepted'")) {
        yield* Ref.update(retryAttemptCount, (count) => count + 1);
        const [dispatchRequestId, entityId, operation] = params.map(String);
        const current = yield* Ref.get(job);
        if (
          current.dispatchRequestId === dispatchRequestId &&
          current.status === "failed" &&
          current.entityType === "dispatchCreation" &&
          current.entityId === entityId &&
          current.operation === operation
        ) {
          yield* Ref.update(retryCount, (count) => count + 1);
          const retried = { ...current, status: "accepted" as const, runId: null, error: null };
          yield* Ref.set(job, retried);
          return [asReturnedRow(retried)];
        }
        return [];
      }

      throw new Error(`Unhandled SQL in dispatch handler test: ${statement}`);
    });

  return Object.assign(sqlFn, {
    withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
  }) as never as SqlClient.SqlClient;
};

const makeSheetApisClient = ({
  checkinMembers = [],
  roomOrderMissing = false,
  roomOrderGuildId = "guild-1",
}: {
  readonly checkinMembers?: ReadonlyArray<{ readonly memberId: string }>;
  readonly roomOrderMissing?: boolean;
  readonly roomOrderGuildId?: string;
} = {}) =>
  ({
    get: () =>
      ({
        messageCheckin: {
          getMessageCheckinMembers: () => Effect.succeed([...checkinMembers]),
        },
        messageRoomOrder: {
          getMessageRoomOrder: () =>
            roomOrderMissing
              ? Effect.fail(makeArgumentError(MESSAGE_ROOM_ORDER_NOT_REGISTERED_ERROR_MESSAGE))
              : Effect.succeed(makeRoomOrder(roomOrderGuildId)),
        },
      }) as never,
  }) as typeof SheetApisClient.Service;

const makeDependencies = ({
  enqueueCount,
  job,
  retryAttemptCount,
  retryCount,
  acceptedPayloads,
  sheetApisClient = makeSheetApisClient(),
}: {
  readonly enqueueCount: Ref.Ref<number>;
  readonly job: Ref.Ref<DispatchJob>;
  readonly retryAttemptCount: Ref.Ref<number>;
  readonly retryCount: Ref.Ref<number>;
  readonly acceptedPayloads?: Ref.Ref<ReadonlyArray<unknown>>;
  readonly sheetApisClient?: typeof SheetApisClient.Service;
}) =>
  Layer.mergeAll(
    Layer.succeed(SqlClient.SqlClient)(
      makeSqlClient({ job, retryAttemptCount, retryCount, acceptedPayloads }),
    ),
    Layer.succeed(SheetApisClient)(sheetApisClient),
    Layer.succeed(Sharding.Sharding)({
      getRegistrationEvents: Stream.empty,
      makeClient: () =>
        Effect.succeed((_entityId: string) => ({
          checkin: () => Ref.update(enqueueCount, (count) => count + 1),
          roomOrder: () => Effect.die("unexpected room-order enqueue"),
          checkinButton: () => Ref.update(enqueueCount, (count) => count + 1),
          roomOrderPreviousButton: () => Ref.update(enqueueCount, (count) => count + 1),
          roomOrderNextButton: () => Effect.die("unexpected room-order next enqueue"),
          roomOrderSendButton: () => Effect.die("unexpected room-order send enqueue"),
          roomOrderPinTentativeButton: () => Ref.update(enqueueCount, (count) => count + 1),
        })),
    } as never),
  );

const runCheckin = ({
  enqueueCount,
  job,
  retryAttemptCount,
  retryCount,
  authUser = monitorSheetAuthUser,
}: {
  readonly enqueueCount: Ref.Ref<number>;
  readonly job: Ref.Ref<DispatchJob>;
  readonly retryAttemptCount: Ref.Ref<number>;
  readonly retryCount: Ref.Ref<number>;
  readonly authUser?: TestAuthUser;
}) => {
  const authMiddleware = SheetApisRpcAuthorization.of((effect) =>
    effect.pipe(Effect.provideService(SheetAuthUser, authUser)),
  );
  const dependencies = makeDependencies({ enqueueCount, job, retryAttemptCount, retryCount });

  return Effect.scoped(
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(DispatchRpcs, { flatten: true });
      return yield* client("dispatch.checkin", { payload });
    }),
  ).pipe(
    Effect.provide(
      Layer.mergeAll(
        dispatchLayer.pipe(Layer.provide(dependencies)),
        RpcMiddleware.layerClient(SheetApisRpcAuthorization, ({ next, request }) => next(request)),
      ),
    ),
    Effect.provideService(SheetApisRpcAuthorization, authMiddleware),
  );
};

const runCheckinButton = ({
  enqueueCount,
  job,
  retryAttemptCount,
  retryCount,
  acceptedPayloads,
  authUser = sheetAuthUser,
  sheetApisClient = makeSheetApisClient(),
}: {
  readonly enqueueCount: Ref.Ref<number>;
  readonly job: Ref.Ref<DispatchJob>;
  readonly retryAttemptCount: Ref.Ref<number>;
  readonly retryCount: Ref.Ref<number>;
  readonly acceptedPayloads?: Ref.Ref<ReadonlyArray<unknown>>;
  readonly authUser?: TestAuthUser;
  readonly sheetApisClient?: typeof SheetApisClient.Service;
}) => {
  const authMiddleware = SheetApisRpcAuthorization.of((effect) =>
    effect.pipe(Effect.provideService(SheetAuthUser, authUser)),
  );
  const dependencies = makeDependencies({
    enqueueCount,
    job,
    retryAttemptCount,
    retryCount,
    acceptedPayloads,
    sheetApisClient,
  });

  return Effect.scoped(
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(DispatchRpcs, { flatten: true });
      return yield* client("dispatch.checkinButton", { payload: checkinButtonPayload });
    }),
  ).pipe(
    Effect.provide(
      Layer.mergeAll(
        dispatchLayer.pipe(Layer.provide(dependencies)),
        RpcMiddleware.layerClient(SheetApisRpcAuthorization, ({ next, request }) => next(request)),
      ),
    ),
    Effect.provideService(SheetApisRpcAuthorization, authMiddleware),
  );
};

const runRoomOrderPreviousButton = ({
  enqueueCount,
  job,
  retryAttemptCount,
  retryCount,
  acceptedPayloads,
  authUser = sheetAuthUser,
  sheetApisClient = makeSheetApisClient(),
}: {
  readonly enqueueCount: Ref.Ref<number>;
  readonly job: Ref.Ref<DispatchJob>;
  readonly retryAttemptCount: Ref.Ref<number>;
  readonly retryCount: Ref.Ref<number>;
  readonly acceptedPayloads?: Ref.Ref<ReadonlyArray<unknown>>;
  readonly authUser?: TestAuthUser;
  readonly sheetApisClient?: typeof SheetApisClient.Service;
}) => {
  const authMiddleware = SheetApisRpcAuthorization.of((effect) =>
    effect.pipe(Effect.provideService(SheetAuthUser, authUser)),
  );
  const dependencies = makeDependencies({
    enqueueCount,
    job,
    retryAttemptCount,
    retryCount,
    acceptedPayloads,
    sheetApisClient,
  });

  return Effect.scoped(
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(DispatchRpcs, { flatten: true });
      return yield* client(DispatchRoomOrderButtonMethods.previous.rpcTag, {
        payload: roomOrderButtonPayload,
      });
    }),
  ).pipe(
    Effect.provide(
      Layer.mergeAll(
        dispatchLayer.pipe(Layer.provide(dependencies)),
        RpcMiddleware.layerClient(SheetApisRpcAuthorization, ({ next, request }) => next(request)),
      ),
    ),
    Effect.provideService(SheetApisRpcAuthorization, authMiddleware),
  );
};

const runRoomOrderPinTentativeButton = ({
  enqueueCount,
  job,
  retryAttemptCount,
  retryCount,
  acceptedPayloads,
  authUser = sheetAuthUser,
  sheetApisClient = makeSheetApisClient(),
}: {
  readonly enqueueCount: Ref.Ref<number>;
  readonly job: Ref.Ref<DispatchJob>;
  readonly retryAttemptCount: Ref.Ref<number>;
  readonly retryCount: Ref.Ref<number>;
  readonly acceptedPayloads?: Ref.Ref<ReadonlyArray<unknown>>;
  readonly authUser?: TestAuthUser;
  readonly sheetApisClient?: typeof SheetApisClient.Service;
}) => {
  const authMiddleware = SheetApisRpcAuthorization.of((effect) =>
    effect.pipe(Effect.provideService(SheetAuthUser, authUser)),
  );
  const dependencies = makeDependencies({
    enqueueCount,
    job,
    retryAttemptCount,
    retryCount,
    acceptedPayloads,
    sheetApisClient,
  });

  return Effect.scoped(
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(DispatchRpcs, { flatten: true });
      return yield* client(DispatchRoomOrderButtonMethods.pinTentative.rpcTag, {
        payload: roomOrderPinTentativeButtonPayload,
      });
    }),
  ).pipe(
    Effect.provide(
      Layer.mergeAll(
        dispatchLayer.pipe(Layer.provide(dependencies)),
        RpcMiddleware.layerClient(SheetApisRpcAuthorization, ({ next, request }) => next(request)),
      ),
    ),
    Effect.provideService(SheetApisRpcAuthorization, authMiddleware),
  );
};

describe("dispatchLayer", () => {
  it.effect("retries failed creation jobs and enqueues them again", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const job = yield* Ref.make(makeFailedJob(storedCreationPayload(payload)));

      const result = yield* runCheckin({ enqueueCount, job, retryAttemptCount, retryCount });

      expect(result).toEqual({
        dispatchRequestId: "dispatch-1",
        entityType: "dispatchCreation",
        entityId: "guild:guild-1",
        operation: "checkin",
        status: "accepted",
      });
      expect(yield* Ref.get(retryAttemptCount)).toBe(1);
      expect(yield* Ref.get(retryCount)).toBe(1);
      expect(yield* Ref.get(enqueueCount)).toBe(1);
    }),
  );

  it.effect("accepts creation dispatches without rechecking forwarded guild permissions", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const job = yield* Ref.make(makeFailedJob(storedCreationPayload(payload)));

      const result = yield* runCheckin({
        enqueueCount,
        job,
        retryAttemptCount,
        retryCount,
        authUser: sheetAuthUser,
      });

      expect(result.status).toBe("accepted");
      expect(yield* Ref.get(retryAttemptCount)).toBe(1);
      expect(yield* Ref.get(retryCount)).toBe(1);
      expect(yield* Ref.get(enqueueCount)).toBe(1);
    }),
  );

  it.effect("requires check-in participant access before accepting button dispatches", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const job = yield* Ref.make(
        makeFailedJob({
          payload,
          requester,
        }),
      );

      const denied = yield* runCheckinButton({
        enqueueCount,
        job,
        retryAttemptCount,
        retryCount,
        sheetApisClient: makeSheetApisClient({ checkinMembers: [{ memberId: "account-2" }] }),
      }).pipe(Effect.flip);

      expect(denied).toBeInstanceOf(Unauthorized);
      expect(yield* Ref.get(retryAttemptCount)).toBe(0);
      expect(yield* Ref.get(retryCount)).toBe(0);
      expect(yield* Ref.get(enqueueCount)).toBe(0);
    }),
  );

  it.effect("persists interaction deadline metadata for check-in button jobs", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const acceptedPayloads = yield* Ref.make<ReadonlyArray<unknown>>([]);
      const job = yield* Ref.make(makeFailedJob(storedCreationPayload(payload)));

      const result = yield* runCheckinButton({
        enqueueCount,
        job,
        retryAttemptCount,
        retryCount,
        acceptedPayloads,
        sheetApisClient: makeSheetApisClient({ checkinMembers: [{ memberId: "account-1" }] }),
      });

      expect(result.entityType).toBe("dispatchMessage");
      expect(yield* Ref.get(acceptedPayloads)).toMatchObject([
        {
          payload: checkinButtonPayload,
          requester,
          interactionDeadlineEpochMs: checkinButtonPayload.interactionDeadlineEpochMs,
        },
      ]);
      expect(yield* Ref.get(enqueueCount)).toBe(1);
    }),
  );

  it.effect(
    "accepts room-order button dispatches without rechecking forwarded guild permissions",
    () =>
      Effect.gen(function* () {
        const enqueueCount = yield* Ref.make(0);
        const retryAttemptCount = yield* Ref.make(0);
        const retryCount = yield* Ref.make(0);
        const acceptedPayloads = yield* Ref.make<ReadonlyArray<unknown>>([]);
        const job = yield* Ref.make(
          makeFailedJob({
            payload,
            requester,
          }),
        );

        const result = yield* runRoomOrderPreviousButton({
          enqueueCount,
          job,
          retryAttemptCount,
          retryCount,
          acceptedPayloads,
        });

        expect(result.entityType).toBe("dispatchMessage");
        expect(result.operation).toBe("roomOrderPreviousButton");
        expect(yield* Ref.get(acceptedPayloads)).toMatchObject([
          {
            payload: roomOrderButtonPayload,
            requester,
            interactionDeadlineEpochMs: roomOrderButtonPayload.interactionDeadlineEpochMs,
            authorizedRoomOrder: {
              guildId: "guild-1",
              messageChannelId: "channel-1",
            },
          },
        ]);
        expect(yield* Ref.get(retryAttemptCount)).toBe(0);
        expect(yield* Ref.get(retryCount)).toBe(0);
        expect(yield* Ref.get(enqueueCount)).toBe(1);
      }),
  );

  it.effect("rejects registered button dispatches when the room-order guild changed", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const job = yield* Ref.make(
        makeFailedJob({
          payload,
          requester,
        }),
      );

      const denied = yield* runRoomOrderPreviousButton({
        enqueueCount,
        job,
        retryAttemptCount,
        retryCount,
        authUser: monitorSheetAuthUser,
        sheetApisClient: makeSheetApisClient({ roomOrderGuildId: "guild-2" }),
      }).pipe(Effect.flip);

      expect(denied).toBeInstanceOf(Unauthorized);
      expect(yield* Ref.get(retryAttemptCount)).toBe(0);
      expect(yield* Ref.get(retryCount)).toBe(0);
      expect(yield* Ref.get(enqueueCount)).toBe(0);
    }),
  );

  it.effect("allows pin-tentative fallback when authorized for the payload guild", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const acceptedPayloads = yield* Ref.make<ReadonlyArray<unknown>>([]);
      const job = yield* Ref.make(
        makeFailedJob({
          payload,
          requester,
        }),
      );

      const result = yield* runRoomOrderPinTentativeButton({
        enqueueCount,
        job,
        retryAttemptCount,
        retryCount,
        acceptedPayloads,
        authUser: monitorSheetAuthUser,
        sheetApisClient: makeSheetApisClient({ roomOrderMissing: true }),
      });

      expect(result.entityType).toBe("dispatchMessage");
      expect(result.entityId).toBe("message:message-1");
      expect(result.operation).toBe("roomOrderPinTentativeButton");
      expect(yield* Ref.get(acceptedPayloads)).toEqual([
        {
          payload: roomOrderPinTentativeButtonPayload,
          requester,
          interactionDeadlineEpochMs: roomOrderPinTentativeButtonPayload.interactionDeadlineEpochMs,
          authorizedRoomOrder: null,
        },
      ]);
      expect(yield* Ref.get(enqueueCount)).toBe(1);
    }),
  );

  it.effect("persists a schema-encoded room-order snapshot for pin-tentative jobs", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const acceptedPayloads = yield* Ref.make<ReadonlyArray<unknown>>([]);
      const job = yield* Ref.make(
        makeFailedJob({
          payload,
          requester,
        }),
      );

      yield* runRoomOrderPinTentativeButton({
        enqueueCount,
        job,
        retryAttemptCount,
        retryCount,
        acceptedPayloads,
        authUser: monitorSheetAuthUser,
      });

      const acceptedPayload = (yield* Ref.get(acceptedPayloads))[0] as {
        readonly authorizedRoomOrder?: { readonly guildId?: string | null };
      };
      expect(acceptedPayload.authorizedRoomOrder).toBeDefined();
      expect(acceptedPayload.authorizedRoomOrder?.guildId).toBe("guild-1");
      expect(yield* Ref.get(enqueueCount)).toBe(1);
    }),
  );

  it.effect("allows pin-tentative fallback after ingress authorized the payload guild", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const job = yield* Ref.make(
        makeFailedJob({
          payload,
          requester,
        }),
      );

      const result = yield* runRoomOrderPinTentativeButton({
        enqueueCount,
        job,
        retryAttemptCount,
        retryCount,
        sheetApisClient: makeSheetApisClient({ roomOrderMissing: true }),
      });

      expect(result.entityType).toBe("dispatchMessage");
      expect(result.operation).toBe("roomOrderPinTentativeButton");
      expect(yield* Ref.get(enqueueCount)).toBe(1);
    }),
  );

  it.effect("rejects failed creation retries with a different payload before enqueueing", () =>
    Effect.gen(function* () {
      const enqueueCount = yield* Ref.make(0);
      const retryAttemptCount = yield* Ref.make(0);
      const retryCount = yield* Ref.make(0);
      const job = yield* Ref.make(
        makeFailedJob({
          payload: { ...payload, channelId: "other-channel" },
          requester,
        }),
      );

      const exit = yield* Effect.exit(
        runCheckin({ enqueueCount, job, retryAttemptCount, retryCount }),
      );

      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(retryAttemptCount)).toBe(0);
      expect(yield* Ref.get(retryCount)).toBe(0);
      expect(yield* Ref.get(enqueueCount)).toBe(0);
    }),
  );
});
