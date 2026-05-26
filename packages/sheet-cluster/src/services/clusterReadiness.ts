import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { config } from "@/config";

type ClusterReadinessRow = {
  readonly ready: boolean;
};

const ClusterRunnerReadinessSnapshotRowSchema = Schema.Struct({
  address: Schema.String,
  hasRecentHealthyRunner: Schema.Boolean,
  heldLockCount: Schema.Number,
  totalRunnerCount: Schema.Number,
  totalLockCount: Schema.Number,
});

type ClusterRunnerReadinessSnapshotDbRow = {
  readonly address: string;
  readonly hasRecentHealthyRunner: boolean;
  readonly heldLockCount: number;
  readonly totalRunnerCount: number;
  readonly totalLockCount: number;
};

const configuredRunnerAddress = Effect.gen(function* () {
  const host = yield* config.clusterRunnerHost;
  const port = yield* config.clusterRunnerPort;
  return `${host}:${port}`;
});

export const isClusterRunnerReady = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const address = yield* configuredRunnerAddress;
  const [row] = yield* sql<ClusterReadinessRow>`
    SELECT EXISTS (
      SELECT 1
      FROM "sheet_apis_cluster_runners"
      WHERE "sheet_apis_cluster_runners".address = ${address}
        AND "sheet_apis_cluster_runners".healthy = TRUE
        AND "sheet_apis_cluster_runners".last_heartbeat > NOW() - INTERVAL '35 seconds'
    ) AS ready
  `;
  return row?.ready === true;
}).pipe(
  Effect.catchCause((cause) =>
    Effect.logWarning("Failed to verify sheet-cluster runner readiness", cause).pipe(
      Effect.as(false),
    ),
  ),
  Effect.withSpan("sheet-cluster.runner.ready"),
);

export const getClusterRunnerReadinessSnapshot = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const address = yield* configuredRunnerAddress;
  const [row] = yield* sql<ClusterRunnerReadinessSnapshotDbRow>`
    SELECT
      ${address} AS address,
      EXISTS (
        SELECT 1
        FROM "sheet_apis_cluster_runners"
        WHERE "sheet_apis_cluster_runners".address = ${address}
          AND "sheet_apis_cluster_runners".healthy = TRUE
          AND "sheet_apis_cluster_runners".last_heartbeat > NOW() - INTERVAL '35 seconds'
      ) AS "hasRecentHealthyRunner",
      (
        SELECT COUNT(*)::int
        FROM "sheet_apis_cluster_locks"
        WHERE "sheet_apis_cluster_locks".address = ${address}
      ) AS "heldLockCount",
      (
        SELECT COUNT(*)::int
        FROM "sheet_apis_cluster_runners"
      ) AS "totalRunnerCount",
      (
        SELECT COUNT(*)::int
        FROM "sheet_apis_cluster_locks"
      ) AS "totalLockCount"
  `;
  return yield* Schema.decodeUnknownEffect(ClusterRunnerReadinessSnapshotRowSchema)(row);
}).pipe(Effect.withSpan("sheet-cluster.runner.readinessSnapshot"));
