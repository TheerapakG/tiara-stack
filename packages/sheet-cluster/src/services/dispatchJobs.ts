import { Context, Data, Effect, Layer } from "effect";
import { randomUUID } from "node:crypto";
import { SqlClient } from "effect/unstable/sql";
import type { DispatchAcceptedResult } from "sheet-ingress-api/sheet-apis-rpc";
import { ensureDispatchJobsSchema } from "./dispatchJobsSchema";

export type DispatchOperation = DispatchAcceptedResult["operation"];
export type DispatchEntityType = DispatchAcceptedResult["entityType"];

export type DispatchJobStatus = "accepted" | "running" | "succeeded" | "failed";

export type DispatchJob = {
  readonly dispatchRequestId: string;
  readonly entityType: DispatchEntityType;
  readonly entityId: string;
  readonly operation: DispatchOperation;
  readonly status: DispatchJobStatus;
  readonly runId: string | null;
  readonly payload: unknown;
  readonly result: unknown;
  readonly error: unknown;
  readonly createdAt: Date;
};

export type DispatchJobAccepted = {
  readonly job: DispatchJob;
  readonly alreadyAccepted: boolean;
};

export class DispatchJobTerminalUpdateRejectedError extends Data.TaggedError(
  "DispatchJobTerminalUpdateRejectedError",
)<{
  readonly dispatchRequestId: string;
  readonly runId: string;
  readonly terminalStatus: "succeeded" | "failed";
  readonly currentRunId: string | null;
  readonly currentStatus: DispatchJobStatus | null;
}> {}

export type DispatchJobRunClaim =
  | {
      readonly _tag: "claimed";
      readonly job: DispatchJob;
      readonly runId: string;
    }
  | {
      readonly _tag: "alreadyRunning";
      readonly job: DispatchJob;
    }
  | {
      readonly _tag: "alreadySucceeded";
      readonly job: DispatchJob;
    }
  | {
      readonly _tag: "alreadyFailed";
      readonly job: DispatchJob;
    };

type DispatchJobRow = {
  readonly dispatch_request_id: string;
  readonly entity_type: DispatchEntityType;
  readonly entity_id: string;
  readonly operation: DispatchOperation;
  readonly status: DispatchJobStatus;
  readonly run_id: string | null;
  readonly payload: unknown;
  readonly result: unknown;
  readonly error: unknown;
  readonly created_at: Date;
};

type AcceptJobInput = {
  readonly dispatchRequestId: string;
  readonly entityType: DispatchEntityType;
  readonly entityId: string;
  readonly operation: DispatchOperation;
  readonly payload: unknown;
};

type RetryCreationJobInput = Omit<AcceptJobInput, "entityType" | "operation"> & {
  readonly operation: "checkin" | "roomOrder";
};

export type DispatchCreationJobPayload = {
  readonly payload: unknown;
  readonly requester: unknown;
};

const rowToJob = (row: DispatchJobRow): DispatchJob => ({
  dispatchRequestId: row.dispatch_request_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  operation: row.operation,
  status: row.status,
  runId: row.run_id,
  payload: row.payload,
  result: row.result,
  error: row.error,
  createdAt: row.created_at,
});

const asJson = (value: unknown): string => JSON.stringify(value);
const runningRecoveryThreshold = "10 minutes";
const acceptedRecoveryThreshold = "10 minutes";

const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, current) => {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return current;
    }

    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });

const normalizeDispatchJobPayloadForComparison = (value: unknown): unknown => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const { interactionDeadlineEpochMs: _interactionDeadlineEpochMs, ...rest } = value as Record<
    string,
    unknown
  >;
  if (rest.payload !== null && typeof rest.payload === "object" && !Array.isArray(rest.payload)) {
    const {
      interactionDeadlineEpochMs: _nestedInteractionDeadlineEpochMs,
      ...payloadWithoutDeadline
    } = rest.payload as Record<string, unknown>;
    return { ...rest, payload: payloadWithoutDeadline };
  }

  return rest;
};

export const hasSameDispatchJobPayload = (job: DispatchJob, payload: unknown): boolean =>
  canonicalJson(normalizeDispatchJobPayloadForComparison(job.payload)) ===
  canonicalJson(normalizeDispatchJobPayloadForComparison(payload));

export class DispatchJobs extends Context.Service<DispatchJobs>()("DispatchJobs", {
  make: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const get = Effect.fn("DispatchJobs.get")(function* (dispatchRequestId: string) {
      const rows = yield* sql<DispatchJobRow>`
        SELECT dispatch_request_id, entity_type, entity_id, operation, status, run_id, payload, result, error, created_at
        FROM sheet_apis_dispatch_jobs
        WHERE dispatch_request_id = ${dispatchRequestId}
      `;
      return rows[0] ? rowToJob(rows[0]) : null;
    });

    const accept = Effect.fn("DispatchJobs.accept")(function* (input: AcceptJobInput) {
      const inserted = yield* sql<DispatchJobRow>`
        INSERT INTO sheet_apis_dispatch_jobs (
          dispatch_request_id,
          entity_type,
          entity_id,
          operation,
          status,
          payload
        )
        VALUES (
          ${input.dispatchRequestId},
          ${input.entityType},
          ${input.entityId},
          ${input.operation},
          'accepted',
          ${asJson(input.payload)}::jsonb
        )
        ON CONFLICT (dispatch_request_id) DO NOTHING
        RETURNING dispatch_request_id, entity_type, entity_id, operation, status, run_id, payload, result, error, created_at
      `;

      if (inserted[0]) {
        return { job: rowToJob(inserted[0]), alreadyAccepted: false };
      }

      const existing = yield* get(input.dispatchRequestId);
      if (existing === null) {
        return yield* Effect.die(`Dispatch job ${input.dispatchRequestId} disappeared`);
      }
      return { job: existing, alreadyAccepted: true };
    });

    const claimRunning = Effect.fn("DispatchJobs.claimRunning")(function* (
      dispatchRequestId: string,
    ) {
      const runId = randomUUID();
      const claimed = yield* sql<DispatchJobRow>`
        UPDATE sheet_apis_dispatch_jobs
        SET status = 'running', run_id = ${runId}, updated_at = NOW()
        WHERE dispatch_request_id = ${dispatchRequestId}
          AND (
            status = 'accepted'
            OR (status = 'running' AND updated_at < NOW() - ${runningRecoveryThreshold}::INTERVAL)
          )
        RETURNING dispatch_request_id, entity_type, entity_id, operation, status, run_id, payload, result, error, created_at
      `;

      if (claimed[0]) {
        return {
          _tag: "claimed",
          job: rowToJob(claimed[0]),
          runId,
        } satisfies DispatchJobRunClaim;
      }

      const existing = yield* get(dispatchRequestId);
      if (existing === null) {
        return yield* Effect.die(`Dispatch job ${dispatchRequestId} disappeared`);
      }

      switch (existing.status) {
        case "running":
          return { _tag: "alreadyRunning", job: existing } satisfies DispatchJobRunClaim;
        case "succeeded":
          return { _tag: "alreadySucceeded", job: existing } satisfies DispatchJobRunClaim;
        case "failed":
          return { _tag: "alreadyFailed", job: existing } satisfies DispatchJobRunClaim;
        case "accepted":
          return yield* Effect.die(`Dispatch job ${dispatchRequestId} could not be claimed`);
      }
    });

    const markSucceeded = Effect.fn("DispatchJobs.markSucceeded")(function* (
      dispatchRequestId: string,
      runId: string,
      result: unknown,
    ) {
      const updated = yield* sql<DispatchJobRow>`
        UPDATE sheet_apis_dispatch_jobs
        SET status = 'succeeded', result = ${asJson(result)}::jsonb, updated_at = NOW()
        WHERE dispatch_request_id = ${dispatchRequestId} AND status = 'running' AND run_id = ${runId}
        RETURNING dispatch_request_id, entity_type, entity_id, operation, status, run_id, payload, result, error, created_at
      `;
      if (updated[0]) {
        return;
      }

      const currentJob = yield* get(dispatchRequestId);
      yield* Effect.logWarning("Dispatch job terminal update rejected", {
        dispatchRequestId,
        runId,
        terminalStatus: "succeeded",
        currentRunId: currentJob?.runId,
        currentStatus: currentJob?.status,
      });
      return yield* Effect.fail(
        new DispatchJobTerminalUpdateRejectedError({
          dispatchRequestId,
          runId,
          terminalStatus: "succeeded",
          currentRunId: currentJob?.runId ?? null,
          currentStatus: currentJob?.status ?? null,
        }),
      );
    });

    const markEnqueueFailed = Effect.fn("DispatchJobs.markEnqueueFailed")(function* (
      dispatchRequestId: string,
      error: unknown,
    ) {
      yield* sql`
        UPDATE sheet_apis_dispatch_jobs
        SET status = 'failed', error = ${asJson(error)}::jsonb, updated_at = NOW()
        WHERE dispatch_request_id = ${dispatchRequestId} AND status = 'accepted'
      `;
    });

    const recoverRunnable = Effect.fn("DispatchJobs.recoverRunnable")(function* () {
      const recovered = yield* sql<DispatchJobRow>`
        WITH recoverable AS (
          SELECT dispatch_request_id
          FROM sheet_apis_dispatch_jobs
          WHERE (
            status = 'running'
            AND updated_at < NOW() - ${runningRecoveryThreshold}::INTERVAL
          ) OR (
            status = 'accepted'
            AND updated_at < NOW() - ${acceptedRecoveryThreshold}::INTERVAL
          )
          ORDER BY updated_at
          LIMIT 100
          FOR UPDATE SKIP LOCKED
        )
        UPDATE sheet_apis_dispatch_jobs
        SET status = 'accepted', run_id = NULL, updated_at = NOW()
        FROM recoverable
        WHERE sheet_apis_dispatch_jobs.dispatch_request_id = recoverable.dispatch_request_id
          AND (
            (
              sheet_apis_dispatch_jobs.status = 'running'
              AND sheet_apis_dispatch_jobs.updated_at < NOW() - ${runningRecoveryThreshold}::INTERVAL
            ) OR (
              sheet_apis_dispatch_jobs.status = 'accepted'
              AND sheet_apis_dispatch_jobs.updated_at < NOW() - ${acceptedRecoveryThreshold}::INTERVAL
            )
          )
        RETURNING sheet_apis_dispatch_jobs.dispatch_request_id,
          sheet_apis_dispatch_jobs.entity_type,
          sheet_apis_dispatch_jobs.entity_id,
          sheet_apis_dispatch_jobs.operation,
          sheet_apis_dispatch_jobs.status,
          sheet_apis_dispatch_jobs.run_id,
          sheet_apis_dispatch_jobs.payload,
          sheet_apis_dispatch_jobs.result,
          sheet_apis_dispatch_jobs.error,
          sheet_apis_dispatch_jobs.created_at
      `;

      return recovered.map(rowToJob);
    });

    const retryFailedCreation = Effect.fn("DispatchJobs.retryFailedCreation")(function* (
      input: RetryCreationJobInput,
    ) {
      const existing = yield* get(input.dispatchRequestId);
      if (
        existing === null ||
        existing.status !== "failed" ||
        existing.entityType !== "dispatchCreation" ||
        existing.entityId !== input.entityId ||
        existing.operation !== input.operation ||
        !hasSameDispatchJobPayload(existing, input.payload)
      ) {
        return existing;
      }

      const retried = yield* sql<DispatchJobRow>`
        UPDATE sheet_apis_dispatch_jobs
        SET status = 'accepted', run_id = NULL, result = NULL, error = NULL, updated_at = NOW()
        WHERE dispatch_request_id = ${input.dispatchRequestId}
          AND status = 'failed'
          AND entity_type = 'dispatchCreation'
          AND entity_id = ${input.entityId}
          AND operation = ${input.operation}
        RETURNING dispatch_request_id, entity_type, entity_id, operation, status, run_id, payload, result, error, created_at
      `;

      if (retried[0]) {
        return rowToJob(retried[0]);
      }

      return yield* get(input.dispatchRequestId);
    });

    const markFailed = Effect.fn("DispatchJobs.markFailed")(function* (
      dispatchRequestId: string,
      runId: string,
      error: unknown,
    ) {
      const updated = yield* sql<DispatchJobRow>`
        UPDATE sheet_apis_dispatch_jobs
        SET status = 'failed', error = ${asJson(error)}::jsonb, updated_at = NOW()
        WHERE dispatch_request_id = ${dispatchRequestId} AND status = 'running' AND run_id = ${runId}
        RETURNING dispatch_request_id, entity_type, entity_id, operation, status, run_id, payload, result, error, created_at
      `;
      if (updated[0]) {
        return;
      }

      const currentJob = yield* get(dispatchRequestId);
      yield* Effect.logWarning("Dispatch job terminal update rejected", {
        dispatchRequestId,
        runId,
        terminalStatus: "failed",
        currentRunId: currentJob?.runId,
        currentStatus: currentJob?.status,
      });
      return yield* Effect.fail(
        new DispatchJobTerminalUpdateRejectedError({
          dispatchRequestId,
          runId,
          terminalStatus: "failed",
          currentRunId: currentJob?.runId ?? null,
          currentStatus: currentJob?.status ?? null,
        }),
      );
    });

    const heartbeatRunning = Effect.fn("DispatchJobs.heartbeatRunning")(function* (
      dispatchRequestId: string,
      runId: string,
    ) {
      yield* sql`
        UPDATE sheet_apis_dispatch_jobs
        SET updated_at = NOW()
        WHERE dispatch_request_id = ${dispatchRequestId} AND status = 'running' AND run_id = ${runId}
      `;
    });

    return {
      acceptCreation: accept,
      acceptButton: (input: AcceptJobInput) => accept(input).pipe(Effect.map(({ job }) => job)),
      claimRunning,
      get,
      markEnqueueFailed,
      recoverRunnable,
      retryFailedCreation,
      heartbeatRunning,
      markSucceeded,
      markFailed,
    };
  }),
}) {
  static schemaLayer = Layer.effectDiscard(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* ensureDispatchJobsSchema(sql);
    }),
  );
  static layer = Layer.effect(DispatchJobs, this.make).pipe(Layer.provide(this.schemaLayer));
}
