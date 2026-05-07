import { Effect } from "effect";
import type { SqlClient } from "effect/unstable/sql";

const dispatchJobsMigrationName = "sheet_cluster.dispatch_jobs.v1";
// v2 was used by an earlier initial-table marker. Keep it as a legacy alias and
// use v3 or a descriptive suffix for the next real dispatch_jobs migration.
const legacyDispatchJobsMigrationName = "sheet_cluster.dispatch_jobs.v2";
const dispatchJobsRecoverRunnableIndexMigrationName =
  "sheet_cluster.dispatch_jobs.recover_runnable_index.v1";

export const ensureDispatchJobsSchema = Effect.fn("DispatchJobs.ensureSchema")(function* (
  sql: SqlClient.SqlClient,
) {
  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('sheet_cluster_dispatch_jobs_schema'))`;
      yield* sql`
        CREATE TABLE IF NOT EXISTS sheet_cluster_migrations (
          name TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      const applied = yield* sql<{ readonly name: string }>`
        SELECT name
        FROM sheet_cluster_migrations
        WHERE name = ${dispatchJobsMigrationName}
          OR name = ${legacyDispatchJobsMigrationName}
      `;

      if (applied.length === 0) {
        yield* sql`
          CREATE TABLE IF NOT EXISTS sheet_apis_dispatch_jobs (
            dispatch_request_id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            status TEXT NOT NULL,
            run_id TEXT,
            payload JSONB NOT NULL,
            result JSONB,
            error JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        yield* sql`
          INSERT INTO sheet_cluster_migrations (name)
          VALUES (${dispatchJobsMigrationName})
          ON CONFLICT (name) DO NOTHING
        `;
      } else if (applied.some((row) => row.name === legacyDispatchJobsMigrationName)) {
        yield* sql`
          INSERT INTO sheet_cluster_migrations (name)
          VALUES (${dispatchJobsMigrationName})
          ON CONFLICT (name) DO NOTHING
        `;
      }

      const indexApplied = yield* sql<{ readonly name: string }>`
        SELECT name
        FROM sheet_cluster_migrations
        WHERE name = ${dispatchJobsRecoverRunnableIndexMigrationName}
      `;

      if (indexApplied.length > 0) {
        return;
      }

      yield* sql`
        CREATE INDEX IF NOT EXISTS sheet_apis_dispatch_jobs_status_updated_at_idx
        ON sheet_apis_dispatch_jobs (status, updated_at)
      `;
      yield* sql`
        INSERT INTO sheet_cluster_migrations (name)
        VALUES (${dispatchJobsRecoverRunnableIndexMigrationName})
        ON CONFLICT (name) DO NOTHING
      `;
    }),
  );
});
