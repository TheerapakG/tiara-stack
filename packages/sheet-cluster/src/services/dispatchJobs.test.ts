import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import {
  DispatchJobTerminalUpdateRejectedError,
  DispatchJobs,
  hasSameDispatchJobPayload,
  type DispatchJob,
  type DispatchJobStatus,
} from "./dispatchJobs";
import { ensureDispatchJobsSchema } from "./dispatchJobsSchema";

const makeJob = (payload: unknown): DispatchJob => ({
  dispatchRequestId: "dispatch-1",
  entityType: "dispatchCreation",
  entityId: "guild:guild-1",
  operation: "checkin",
  status: "accepted",
  runId: null,
  payload,
  result: null,
  error: null,
  createdAt: new Date(0),
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
  updatedAt: number;
};

const makeSqlClient = ({
  initialMigrations = [],
}: {
  readonly initialMigrations?: ReadonlyArray<string>;
} = {}) => {
  const rows = new Map<string, StoredJob>();
  const migrations = new Set<string>(initialMigrations);
  let now = 0;
  let dispatchJobsDdlRuns = 0;

  const asReturnedRow = (row: StoredJob) => ({
    dispatch_request_id: row.dispatch_request_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    operation: row.operation,
    status: row.status,
    run_id: row.run_id,
    payload: row.payload,
    result: row.result,
    error: row.error,
    created_at: row.created_at,
  });

  const sqlFn = (strings: TemplateStringsArray, ...params: ReadonlyArray<unknown>) =>
    Effect.sync(() => {
      const statement = strings.join("?");
      if (statement.includes("pg_advisory_xact_lock")) {
        return [];
      }

      if (statement.includes("CREATE TABLE IF NOT EXISTS sheet_cluster_migrations")) {
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

      if (
        statement.includes("CREATE TABLE IF NOT EXISTS sheet_apis_dispatch_jobs") ||
        statement.includes("ALTER TABLE sheet_apis_dispatch_jobs") ||
        statement.includes(
          "CREATE INDEX IF NOT EXISTS sheet_apis_dispatch_jobs_status_updated_at_idx",
        )
      ) {
        dispatchJobsDdlRuns += 1;
        return [];
      }

      if (statement.includes("INSERT INTO sheet_apis_dispatch_jobs")) {
        const dispatchRequestId = String(params[0]);
        if (rows.has(dispatchRequestId)) {
          return [];
        }
        const row: StoredJob = {
          dispatch_request_id: dispatchRequestId,
          entity_type: params[1] as DispatchJob["entityType"],
          entity_id: String(params[2]),
          operation: params[3] as DispatchJob["operation"],
          status: "accepted",
          run_id: null,
          payload: JSON.parse(String(params[4])),
          result: null,
          error: null,
          created_at: new Date(now),
          updatedAt: now,
        };
        rows.set(dispatchRequestId, row);
        return [asReturnedRow(row)];
      }

      if (statement.includes("SET status = 'running'")) {
        const [runId, dispatchRequestId] = params.map(String);
        const row = rows.get(dispatchRequestId);
        if (
          row &&
          (row.status === "accepted" || (row.status === "running" && now - row.updatedAt > 120000))
        ) {
          row.status = "running";
          row.run_id = runId;
          row.updatedAt = now;
          return [asReturnedRow(row)];
        }
        return [];
      }

      if (statement.includes("FROM recoverable")) {
        return [...rows.values()]
          .filter(
            (row) =>
              (row.status === "running" && now - row.updatedAt > 120000) ||
              (row.status === "accepted" && now - row.updatedAt > 600000),
          )
          .sort((left, right) => left.updatedAt - right.updatedAt)
          .slice(0, 100)
          .map((row) => {
            row.status = "accepted";
            row.run_id = null;
            row.updatedAt = now;
            return asReturnedRow(row);
          });
      }

      if (statement.includes("SELECT dispatch_request_id")) {
        const row = rows.get(String(params[0]));
        return row ? [asReturnedRow(row)] : [];
      }

      if (statement.includes("SET status = 'accepted'")) {
        const [dispatchRequestId, entityId, operation] = params.map(String);
        const row = rows.get(dispatchRequestId);
        if (
          row?.status === "failed" &&
          row.entity_type === "dispatchCreation" &&
          row.entity_id === entityId &&
          row.operation === operation
        ) {
          row.status = "accepted";
          row.run_id = null;
          row.result = null;
          row.error = null;
          row.updatedAt = now;
          return [asReturnedRow(row)];
        }
        return [];
      }

      if (statement.includes("SET status = 'succeeded'")) {
        const [result, dispatchRequestId, runId] = params.map(String);
        const row = rows.get(dispatchRequestId);
        if (row?.status === "running" && row.run_id === runId) {
          row.status = "succeeded";
          row.result = JSON.parse(result);
          row.updatedAt = now;
          return [asReturnedRow(row)];
        }
        return [];
      }

      if (statement.includes("SET status = 'failed'") && statement.includes("status = 'running'")) {
        const [error, dispatchRequestId, runId] = params.map(String);
        const row = rows.get(dispatchRequestId);
        if (row?.status === "running" && row.run_id === runId) {
          row.status = "failed";
          row.error = JSON.parse(error);
          row.updatedAt = now;
          return [asReturnedRow(row)];
        }
        return [];
      }

      if (
        statement.includes("SET status = 'failed'") &&
        statement.includes("status = 'accepted'")
      ) {
        const [error, dispatchRequestId] = params.map(String);
        const row = rows.get(dispatchRequestId);
        if (row?.status === "accepted") {
          row.status = "failed";
          row.error = JSON.parse(error);
          row.updatedAt = now;
        }
        return [];
      }

      if (statement.includes("SET updated_at = NOW()")) {
        const [dispatchRequestId, runId] = params.map(String);
        const row = rows.get(dispatchRequestId);
        if (row?.status === "running" && row.run_id === runId) {
          row.updatedAt = now;
        }
        return [];
      }

      throw new Error(`Unhandled SQL in test: ${statement}`);
    });
  const sql = Object.assign(sqlFn, {
    withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
  }) as never as SqlClient.SqlClient;

  return {
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    dispatchJobsDdlRuns: () => dispatchJobsDdlRuns,
    migrations: () => new Set(migrations),
    make: DispatchJobs.make.pipe(Effect.provideService(SqlClient.SqlClient, sql)),
    schema: ensureDispatchJobsSchema(sql),
  };
};

describe("DispatchJobs", () => {
  it.effect("runs dispatch jobs DDL only once after migration is recorded", () =>
    Effect.gen(function* () {
      const client = makeSqlClient();

      yield* client.schema.pipe(Effect.scoped);
      expect(client.dispatchJobsDdlRuns()).toBe(2);
      expect(client.migrations()).toEqual(
        new Set([
          "sheet_cluster.dispatch_jobs.v1",
          "sheet_cluster.dispatch_jobs.recover_runnable_index.v1",
        ]),
      );

      yield* client.schema.pipe(Effect.scoped);
      expect(client.dispatchJobsDdlRuns()).toBe(2);
    }),
  );

  it.effect("recognizes the previous dispatch jobs migration marker as already applied", () =>
    Effect.gen(function* () {
      const client = makeSqlClient({
        initialMigrations: [
          "sheet_cluster.dispatch_jobs.v2",
          "sheet_cluster.dispatch_jobs.recover_runnable_index.v1",
        ],
      });

      yield* client.schema.pipe(Effect.scoped);

      expect(client.dispatchJobsDdlRuns()).toBe(0);
      expect(client.migrations()).toEqual(
        new Set([
          "sheet_cluster.dispatch_jobs.v1",
          "sheet_cluster.dispatch_jobs.v2",
          "sheet_cluster.dispatch_jobs.recover_runnable_index.v1",
        ]),
      );
    }),
  );

  it("matches semantically equal JSON payloads independent of object key order", () => {
    const job = makeJob({
      payload: {
        guildId: "guild-1",
        channelId: "channel-1",
      },
      requester: {
        accountId: "account-1",
        userId: "user-1",
      },
    });

    expect(
      hasSameDispatchJobPayload(job, {
        requester: {
          userId: "user-1",
          accountId: "account-1",
        },
        payload: {
          channelId: "channel-1",
          guildId: "guild-1",
        },
      }),
    ).toBe(true);
  });

  it("rejects payloads with different dispatch inputs", () => {
    const job = makeJob({
      payload: {
        guildId: "guild-1",
        channelId: "channel-1",
      },
      requester: {
        accountId: "account-1",
        userId: "user-1",
      },
    });

    expect(
      hasSameDispatchJobPayload(job, {
        payload: {
          guildId: "guild-1",
          channelId: "channel-2",
        },
        requester: {
          accountId: "account-1",
          userId: "user-1",
        },
      }),
    ).toBe(false);
  });

  it("matches legacy nested and current root interaction deadlines", () => {
    const job = makeJob({
      payload: {
        guildId: "guild-1",
        channelId: "channel-1",
        interactionDeadlineEpochMs: 1,
      },
      requester: {
        accountId: "account-1",
        userId: "user-1",
      },
    });

    expect(
      hasSameDispatchJobPayload(job, {
        interactionDeadlineEpochMs: 2,
        payload: {
          guildId: "guild-1",
          channelId: "channel-1",
        },
        requester: {
          accountId: "account-1",
          userId: "user-1",
        },
      }),
    ).toBe(true);
  });

  it("preserves other nested dispatch payload differences", () => {
    const job = makeJob({
      payload: {
        guildId: "guild-1",
        channelId: "channel-1",
        interactionDeadlineEpochMs: 1,
      },
      requester: {
        accountId: "account-1",
        userId: "user-1",
      },
    });

    expect(
      hasSameDispatchJobPayload(job, {
        payload: {
          guildId: "guild-1",
          channelId: "channel-2",
          interactionDeadlineEpochMs: 1,
        },
        requester: {
          accountId: "account-1",
          userId: "user-1",
        },
      }),
    ).toBe(false);
  });

  it.effect("claims accepted jobs and fences terminal updates by run id", () =>
    Effect.gen(function* () {
      const client = makeSqlClient();
      const jobs = yield* client.make;
      yield* jobs.acceptCreation({
        dispatchRequestId: "dispatch-1",
        entityType: "dispatchCreation",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: { guildId: "guild-1" },
      });

      const claim = yield* jobs.claimRunning("dispatch-1");
      expect(claim._tag).toBe("claimed");
      if (claim._tag !== "claimed") {
        return;
      }

      const mismatch = yield* jobs
        .markSucceeded("dispatch-1", "wrong-run-id", { ok: false })
        .pipe(Effect.flip);
      expect(mismatch).toBeInstanceOf(DispatchJobTerminalUpdateRejectedError);
      if (mismatch instanceof DispatchJobTerminalUpdateRejectedError) {
        expect(mismatch.terminalStatus).toBe("succeeded");
        expect(mismatch.currentStatus).toBe("running");
      }
      expect((yield* jobs.get("dispatch-1"))?.status).toBe("running");

      yield* jobs.markSucceeded("dispatch-1", claim.runId, { ok: true });
      const completed = yield* jobs.get("dispatch-1");
      expect(completed?.status).toBe("succeeded");
      expect(completed?.result).toEqual({ ok: true });
    }),
  );

  it.effect("resets failed creation jobs for retry", () =>
    Effect.gen(function* () {
      const client = makeSqlClient();
      const jobs = yield* client.make;
      yield* jobs.acceptCreation({
        dispatchRequestId: "dispatch-1",
        entityType: "dispatchCreation",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: {
          requester: { accountId: "account-1", userId: "user-1" },
          payload: {
            channelId: "channel-1",
            dispatchRequestId: "dispatch-1",
            guildId: "guild-1",
          },
        },
      });
      yield* jobs.markEnqueueFailed("dispatch-1", { enqueue: "failed" });

      const failed = yield* jobs.get("dispatch-1");
      expect(failed?.status).toBe("failed");
      expect(failed?.error).toEqual({ enqueue: "failed" });

      const retried = yield* jobs.retryFailedCreation({
        dispatchRequestId: "dispatch-1",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: {
          payload: {
            dispatchRequestId: "dispatch-1",
            guildId: "guild-1",
            channelId: "channel-1",
          },
          requester: { userId: "user-1", accountId: "account-1" },
        },
      });
      expect(retried?.status).toBe("accepted");
      expect(retried?.runId).toBeNull();
      expect(retried?.result).toBeNull();
      expect(retried?.error).toBeNull();
    }),
  );

  it.effect("keeps failed creation jobs failed when retry payload differs", () =>
    Effect.gen(function* () {
      const client = makeSqlClient();
      const jobs = yield* client.make;
      yield* jobs.acceptCreation({
        dispatchRequestId: "dispatch-1",
        entityType: "dispatchCreation",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: { guildId: "guild-1", channelId: "channel-1" },
      });
      yield* jobs.markEnqueueFailed("dispatch-1", { enqueue: "failed" });

      const retried = yield* jobs.retryFailedCreation({
        dispatchRequestId: "dispatch-1",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: { guildId: "guild-1", channelId: "channel-2" },
      });

      expect(retried?.status).toBe("failed");
      const stored = yield* jobs.get("dispatch-1");
      expect(stored?.status).toBe("failed");
      expect(stored?.error).toEqual({ enqueue: "failed" });
    }),
  );

  it.effect("keeps active heartbeat claims from being reclaimed as stale", () =>
    Effect.gen(function* () {
      const client = makeSqlClient();
      const jobs = yield* client.make;
      yield* jobs.acceptCreation({
        dispatchRequestId: "dispatch-1",
        entityType: "dispatchCreation",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: { guildId: "guild-1" },
      });

      const claim = yield* jobs.claimRunning("dispatch-1");
      expect(claim._tag).toBe("claimed");
      if (claim._tag !== "claimed") {
        return;
      }

      client.advance(119000);
      yield* jobs.heartbeatRunning("dispatch-1", claim.runId);
      client.advance(119000);

      const secondClaim = yield* jobs.claimRunning("dispatch-1");
      expect(secondClaim._tag).toBe("alreadyRunning");
      expect(secondClaim.job.runId).toBe(claim.runId);
    }),
  );

  it.effect("does not re-enqueue accepted jobs until the accepted recovery threshold elapses", () =>
    Effect.gen(function* () {
      const client = makeSqlClient();
      const jobs = yield* client.make;
      yield* jobs.acceptCreation({
        dispatchRequestId: "dispatch-1",
        entityType: "dispatchCreation",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: { guildId: "guild-1" },
      });

      client.advance(121000);
      expect(yield* jobs.recoverRunnable()).toEqual([]);

      client.advance(480000);
      const recovered = yield* jobs.recoverRunnable();
      expect(recovered).toHaveLength(1);
      expect(recovered[0]?.dispatchRequestId).toBe("dispatch-1");
      expect(recovered[0]?.status).toBe("accepted");
    }),
  );

  it.effect("reclaims stale running jobs and ignores old run terminal updates", () =>
    Effect.gen(function* () {
      const client = makeSqlClient();
      const jobs = yield* client.make;
      yield* jobs.acceptCreation({
        dispatchRequestId: "dispatch-1",
        entityType: "dispatchCreation",
        entityId: "guild:guild-1",
        operation: "checkin",
        payload: { guildId: "guild-1" },
      });

      const firstClaim = yield* jobs.claimRunning("dispatch-1");
      expect(firstClaim._tag).toBe("claimed");
      if (firstClaim._tag !== "claimed") {
        return;
      }

      client.advance(601000);
      const secondClaim = yield* jobs.claimRunning("dispatch-1");
      expect(secondClaim._tag).toBe("claimed");
      if (secondClaim._tag !== "claimed") {
        return;
      }
      expect(secondClaim.runId).not.toBe(firstClaim.runId);

      const mismatch = yield* jobs
        .markFailed("dispatch-1", firstClaim.runId, { stale: true })
        .pipe(Effect.flip);
      expect(mismatch).toBeInstanceOf(DispatchJobTerminalUpdateRejectedError);
      if (mismatch instanceof DispatchJobTerminalUpdateRejectedError) {
        expect(mismatch.terminalStatus).toBe("failed");
        expect(mismatch.currentStatus).toBe("running");
      }
      expect((yield* jobs.get("dispatch-1"))?.status).toBe("running");

      yield* jobs.markFailed("dispatch-1", secondClaim.runId, { stale: false });
      const failed = yield* jobs.get("dispatch-1");
      expect(failed?.status).toBe("failed");
      expect(failed?.error).toEqual({ stale: false });
    }),
  );
});
