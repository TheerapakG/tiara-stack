import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect, it } from "vitest";
import type { CodexReviewClient, CodexRunOptions, CodexRunResult } from "../codex/client";
import { sqliteLayer } from "../db/client";
import { CodexAgentTimedOut, type AgentAspect } from "./types";
import { runCheckpointedReviewWithClient } from "./workflow";

const git = (cwd: string, args: ReadonlyArray<string>) =>
  execFileSync("git", [...args], { cwd, encoding: "utf8" }).trimEnd();

const makeRepo = () => {
  const repo = mkdtempSync(join(tmpdir(), "tiara-review-workflow."));
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "Test User"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  git(repo, ["config", "tag.gpgsign", "false"]);
  writeFileSync(join(repo, "a.ts"), "export const a = 1;\n");
  git(repo, ["add", "a.ts"]);
  git(repo, ["commit", "-m", "initial"]);
  writeFileSync(join(repo, "a.ts"), "export const a = 2;\n");
  return repo;
};

const latestRunStatus = (dbPath: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql<{ readonly status: string }>`
        select status
        from review_runs
        order by created_at desc
        limit 1
      `;
      return rows[0]?.status;
    }).pipe(Effect.provide(sqliteLayer(dbPath))),
  );

class MockCodexClient implements CodexReviewClient {
  readonly calls: Array<AgentAspect> = [];
  readonly prompts: Array<{ readonly aspect: AgentAspect; readonly prompt: string }> = [];

  constructor(
    readonly failAspect?: AgentAspect,
    readonly timeoutAspect?: AgentAspect,
  ) {}

  runStructured<A>(
    prompt: string,
    options: CodexRunOptions,
  ): Effect.Effect<CodexRunResult<A>, never> {
    this.calls.push(options.aspect);
    this.prompts.push({ aspect: options.aspect, prompt });
    if (this.timeoutAspect === options.aspect) {
      return Effect.fail(
        new CodexAgentTimedOut({
          aspect: options.aspect,
          timeoutMs: options.timeoutMs ?? 0,
        }),
      ) as never;
    }
    if (this.failAspect === options.aspect) {
      return Effect.fail("failed") as never;
    }
    if (options.aspect === "external-review-parser") {
      return Effect.succeed({
        threadId: "thread-external-review-parser",
        output: {
          findings: [
            {
              severity: "medium",
              type: "security",
              location: "a.ts:1",
              issue: "Imported security issue",
              evidence: "external evidence",
              suggestedFix: "external fix",
            },
          ],
          skippedFindings: [{ reason: "missing issue", excerpt: "bad block" }],
          warnings: ["defaulted a field"],
        },
      } as CodexRunResult<A>);
    }
    if (options.aspect === "orchestrator") {
      return Effect.succeed({
        threadId: "thread-orchestrator",
        output: {
          baseReviewed: "HEAD",
          currentCheckpoint: "checkpoint",
          safetyConfidence: this.calls.includes("security") ? 4 : 3,
          issues: [
            {
              severity: "medium",
              type: "logic-bug",
              location: "a.ts:1",
              issue: "Consolidated issue",
              evidence: "evidence",
              suggestedFix: "fix",
            },
          ],
          priorIssuesRechecked: [],
          reviewNotes: [],
        },
      } as CodexRunResult<A>);
    }
    return Effect.succeed({
      threadId: `thread-${options.aspect}`,
      output: {
        aspect: options.aspect,
        findings: [],
        priorIssuesRechecked: [],
        contextUsed: {
          baseReviewed: "HEAD",
          currentCheckpoint: "checkpoint",
          extraContextInspected: "none",
        },
        markdown: `## ${options.aspect}`,
      },
    } as CodexRunResult<A>);
  }
}

describe("workflow", () => {
  it("runs six specialists before the orchestrator and persists the final report", async () => {
    const repo = makeRepo();
    const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-workflow-db."));
    try {
      const client = new MockCodexClient();
      const result = await Effect.runPromise(
        runCheckpointedReviewWithClient(
          {
            cwd: repo,
            dbPath: join(dbDir, "reviews.sqlite"),
          },
          client,
        ),
      );
      expect(client.calls.slice(0, 6).sort()).toEqual([
        "code-quality",
        "logic-bugs",
        "maintainability",
        "race-conditions",
        "security",
        "test-flakiness",
      ]);
      expect(client.calls[6]).toBe("orchestrator");
      expect(result.findings).toHaveLength(1);
      expect(result.reportMarkdown).toContain("Checkpointed Review Report");
      expect(result.failedAspects).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("continues to orchestration when one specialist fails", async () => {
    const repo = makeRepo();
    const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-workflow-db."));
    try {
      const client = new MockCodexClient("security");
      const result = await Effect.runPromise(
        runCheckpointedReviewWithClient(
          {
            cwd: repo,
            dbPath: join(dbDir, "reviews.sqlite"),
          },
          client,
        ),
      );
      expect(client.calls).toContain("orchestrator");
      expect(result.failedAspects).toEqual(["security"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("stores timed-out status for specialist failures", async () => {
    const repo = makeRepo();
    const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-workflow-db."));
    const dbPath = join(dbDir, "reviews.sqlite");
    try {
      const client = new MockCodexClient(undefined, "security");
      await Effect.runPromise(
        runCheckpointedReviewWithClient(
          {
            cwd: repo,
            dbPath,
            timeoutMs: 1,
          },
          client,
        ),
      );
      const status = await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql.unsafe<{ readonly status: string }>(
            `select status from review_agents where aspect = 'security'`,
          );
          return rows[0]?.status;
        }).pipe(Effect.provide(sqliteLayer(dbPath))),
      );
      expect(status).toBe("timed-out");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("stores timed-out status for orchestrator failures", async () => {
    const repo = makeRepo();
    const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-workflow-db."));
    const dbPath = join(dbDir, "reviews.sqlite");
    try {
      const client = new MockCodexClient(undefined, "orchestrator");
      await expect(
        Effect.runPromise(
          runCheckpointedReviewWithClient(
            {
              cwd: repo,
              dbPath,
              timeoutMs: 1,
            },
            client,
          ),
        ),
      ).rejects.toBeDefined();
      const status = await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql.unsafe<{ readonly status: string }>(
            `select status from review_agents where aspect = 'orchestrator'`,
          );
          return rows[0]?.status;
        }).pipe(Effect.provide(sqliteLayer(dbPath))),
      );
      expect(status).toBe("timed-out");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("imports external review markdown before spawning specialists", async () => {
    const repo = makeRepo();
    const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-workflow-db."));
    try {
      const client = new MockCodexClient();
      const result = await Effect.runPromise(
        runCheckpointedReviewWithClient(
          {
            cwd: repo,
            dbPath: join(dbDir, "reviews.sqlite"),
            externalReviewMarkdown: "external review markdown",
          },
          client,
        ),
      );

      expect(client.calls[0]).toBe("external-review-parser");
      expect(client.calls.slice(1, 7).sort()).toEqual([
        "code-quality",
        "logic-bugs",
        "maintainability",
        "race-conditions",
        "security",
        "test-flakiness",
      ]);
      expect(result.externalReviewImport).toEqual({
        importedFindingCount: 1,
        skippedFindingCount: 1,
        warnings: ["defaulted a field"],
        codexThreadId: "thread-external-review-parser",
      });
      expect(client.prompts.find((entry) => entry.aspect === "security")?.prompt).toContain(
        "Imported security issue",
      );
      expect(client.prompts.find((entry) => entry.aspect === "security")?.prompt).toContain(
        "Source: external-review",
      );
      expect(
        client.prompts.find((entry) => entry.aspect === "maintainability")?.prompt,
      ).not.toContain("Imported security issue");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("fails before specialists when external review parsing fails", async () => {
    const repo = makeRepo();
    const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-workflow-db."));
    const dbPath = join(dbDir, "reviews.sqlite");
    try {
      const client = new MockCodexClient("external-review-parser");
      await expect(
        Effect.runPromise(
          runCheckpointedReviewWithClient(
            {
              cwd: repo,
              dbPath,
              externalReviewMarkdown: "external review markdown",
            },
            client,
          ),
        ),
      ).rejects.toBeDefined();
      expect(client.calls).toEqual(["external-review-parser"]);
      await expect(latestRunStatus(dbPath)).resolves.toBe("failed");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("removes checkpoint refs when the workflow fails after checkpoint capture", async () => {
    const repo = makeRepo();
    const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-workflow-db."));
    try {
      const client = new MockCodexClient("external-review-parser");
      await expect(
        Effect.runPromise(
          runCheckpointedReviewWithClient(
            {
              cwd: repo,
              dbPath: join(dbDir, "reviews.sqlite"),
              externalReviewMarkdown: "external review markdown",
            },
            client,
          ),
        ),
      ).rejects.toBeDefined();
      expect(
        git(repo, ["for-each-ref", "--format=%(refname)", "refs/tiara-review-checkpoints/"]),
      ).toBe("");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dbDir, { recursive: true, force: true });
    }
  });
});
