export const migrations = [
  `CREATE TABLE IF NOT EXISTS review_runs (
    id text primary key,
    repo_root text not null,
    branch text,
    head_commit text,
    base_ref text not null,
    base_commit text,
    checkpoint_ref text not null,
    checkpoint_commit text not null,
    checkpoint_created_at integer,
    diff_hash text not null,
    diff_stat_json text not null,
    created_at integer not null,
    completed_at integer,
    status text not null,
    safety_confidence integer,
    report_markdown text,
    report_json text,
    error text
  )`,
  `CREATE TABLE IF NOT EXISTS review_agents (
    id text primary key,
    run_id text not null references review_runs(id),
    aspect text not null,
    codex_thread_id text,
    status text not null,
    started_at integer not null,
    completed_at integer,
    error text
  )`,
  `CREATE TABLE IF NOT EXISTS findings (
    id text primary key,
    run_id text not null references review_runs(id),
    agent_id text references review_agents(id),
    source text not null,
    severity text not null,
    type text not null,
    location text,
    issue text not null,
    evidence text not null,
    suggested_fix text not null,
    status text not null,
    dedupe_key text not null,
    created_at integer not null
  )`,
  `CREATE TABLE IF NOT EXISTS prior_issue_rechecks (
    id text primary key,
    run_id text not null references review_runs(id),
    finding_id text references findings(id),
    prior_finding_id text references findings(id),
    status text not null,
    evidence text not null
  )`,
  `CREATE INDEX IF NOT EXISTS review_runs_repo_root_created_at_idx ON review_runs(repo_root, created_at)`,
  `CREATE INDEX IF NOT EXISTS findings_run_id_idx ON findings(run_id)`,
  `CREATE INDEX IF NOT EXISTS findings_status_type_idx ON findings(status, type)`,
  `CREATE INDEX IF NOT EXISTS findings_dedupe_key_idx ON findings(dedupe_key)`,
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    id text primary key,
    applied_at integer not null
  )`,
] as const;
