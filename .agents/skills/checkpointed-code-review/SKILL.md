---
name: checkpointed-code-review
description: Run a checkpointed multi-agent code review over recent working-directory changes, with specialist reviewers for security, quality, bugs, races, test flakiness, and maintainability.
---

# Checkpointed Code Review

Use this skill when the developer asks for a checkpointed code review, a multi-agent review of current changes, or explicitly invokes `$checkpointed-code-review`.

Checkpointing is handled by the `tiara-review` CLI package. It captures the full working directory into a synthetic commit via a temporary index, stores it under a hidden ref, chooses an appropriate review base, loads unresolved historical findings from its local SQLite database, runs specialist Codex reviewers, and consolidates the final report. A normal checked-out Git repository directory is sufficient; no separate `git worktree` checkout is required.

## Main Agent Workflow

1. Run the CLI from the repository root:

   ```bash
   pnpm --filter tiara-review exec tiara-review run --cwd "$PWD"
   ```

   If the package has not been linked into `pnpm exec` yet, use the built binary after running `pnpm --filter tiara-review build`:

   ```bash
   node packages/tiara-review/dist/index.mjs run --cwd "$PWD"
   ```

2. If the developer provides review findings from another agent, PR review, previous tool, or pasted Markdown, pipe that review text through stdin with `--review-stdin`:

   ```bash
   cat other-review.md | pnpm --filter tiara-review exec tiara-review run --cwd "$PWD" --review-stdin
   ```

   The CLI uses Codex structured output to parse that Markdown into findings, persists parsed findings in SQLite, and rechecks them in the current and future runs.

3. Return the CLI's consolidated report to the developer, including issues, prior issue rechecks, review notes, and the safety confidence score.
4. Do not fix anything unless the developer explicitly asks for fixes.
5. If the developer explicitly requests a review loop, repeat review/fix/review as instructed; otherwise run one review pass only.
6. After reporting, tell the developer that checkpoint refs are retained under `refs/tiara-review-checkpoints/`; prune them only when the developer asks.

The main agent should not manually spawn reviewer or orchestrator sub-agents for this skill. The CLI owns specialist fan-out, orchestrator consolidation, Codex thread tracking, checkpoint capture, and prior-finding persistence.

## Checkpoint Helper

Do not call `scripts/capture_checkpoint.sh` for normal reviews. It is retained only as historical fallback material. Use `tiara-review run`, which reimplements the checkpoint capture behavior in TypeScript/Effect.

The CLI:

- Must be run inside a Git working tree: a normal checked-out repository directory is sufficient.
- Does not require a separate `git worktree` checkout.
- Uses a temporary Git index via `GIT_INDEX_FILE`.
- If `HEAD` exists, initializes the temporary index with `git read-tree HEAD`.
- Adds tracked changes and unignored untracked files with `git add -A -- .`; gitignored files are excluded from the checkpoint.
- Creates a tree with `git write-tree`.
- Creates a synthetic commit with `git commit-tree`, using `HEAD` as parent when `HEAD` exists.
- Stores it with `git update-ref`.
- Stores run metadata, Codex thread IDs, consolidated findings, prior issue rechecks, and final reports in a local SQLite database.
- Captures on-disk working-directory state, not staged-only index state such as partial staging or `git rm --cached`.

The CLI must not modify the current branch, modify the user's real index, commit to the checked-out branch, restore files, or clean files.

## Checkpoint Privacy Boundary

The checkpoint captures tracked files plus unignored untracked files, matching `git add -A -- .` behavior in a temporary index. `.gitignore` only excludes untracked files; tracked files are captured even if they are now ignored. Local secrets such as `.env` files, private keys, credential dumps, or scratch files can be included in the synthetic checkpoint and in the diff sent to Codex when they are tracked or unignored. Before running the CLI on sensitive repositories, remove private files from tracking with `git rm --cached` and add matching `.gitignore` rules before leaving them on disk, or move secret files outside the reviewed worktree.

By default, SQLite data is stored at `$XDG_DATA_HOME/tiara-review/reviews.sqlite`, falling back to `~/.local/share/tiara-review/reviews.sqlite`. Use `--db <path>` only when the developer asks for an alternate database.

## Checkpoint Retention

Checkpoint refs are persistent Git refs under `refs/tiara-review-checkpoints/`. The CLI scopes checkpoint refs by worktree root and uses the SQLite run history to choose completed prior checkpoints for the same repository and branch. Do not delete checkpoint refs automatically unless the developer asks.

When asked to prune stale checkpoints, keep the most recent 20 refs and delete older refs with `git update-ref -d <ref>`. Use `git for-each-ref --sort=-committerdate --format='%(refname)' refs/tiara-review-checkpoints/` to list refs newest first before deleting.

## CLI Review Responsibilities

The CLI must:

1. Capture the current working-directory checkpoint.
2. Determine the review base from the latest completed CLI review checkpoint for the same repository and branch, falling back to `HEAD` or an empty tree when needed.
3. Generate the initial diff between the base and current checkpoint.
4. Spawn six specialist Codex reviewer threads:
   - Security
   - Code quality
   - Logic bugs
   - Race conditions
   - Test flakiness
   - Maintainability
5. Give each reviewer:
   - The base ref or commit.
   - The current checkpoint ref.
   - The initial diff.
   - Its assigned review aspect.
   - Relevant unresolved prior issues for that aspect loaded from SQLite.
6. Tell reviewers to focus first on the diff between the current checkpoint and the chosen base.
7. Allow reviewers to incrementally inspect surrounding code and earlier checkpoints/commits only when the diff lacks enough context.
8. If any specialist reviewer fails to start, errors, or does not respond, record the missing category in Review Notes and lower the safety confidence to reflect incomplete coverage.
9. Merge duplicate findings across reviewers.
10. Return one consolidated report to the main agent.

## Specialist Reviewer Instructions

Each specialist reviewer must:

- Review only its assigned aspect.
- Start with the diff between the current checkpoint and the chosen base.
- Use surrounding code only when needed to assess the changed behavior.
- Reach for earlier checkpoints or commits only incrementally when the diff and surrounding code lack enough context.
- Recheck any prior unresolved issues routed to it.
- Report concrete risks only; do not include style preferences without user-visible or maintenance impact.

Each specialist reviewer must return:

```markdown
## <Aspect> Review

### Findings

- Severity: high|medium|low
  Type: security|code-quality|logic-bug|race-condition|test-flakiness|maintainability
  Location: path:line when available
  Issue: concise description
  Evidence: why this is a real risk
  Suggested fix: concise remediation

### Prior Issues Rechecked

- Prior issue: description
  Status: fixed|not-fixed|unclear
  Evidence: concise explanation

### Context Used

- Base reviewed: <ref-or-commit>
- Current checkpoint: <ref>
- Extra context inspected: files/checkpoints/commits, or "none"
```

## Orchestrator Output

The orchestrator must return:

```markdown
## Checkpointed Review Report

Base reviewed: <base-ref-or-commit>
Current checkpoint: <checkpoint-ref>
Safety confidence: <0-5>/5

### Issues

1. Severity: high|medium|low
   Type: security|code-quality|logic-bug|race-condition|test-flakiness|maintainability
   Location: path:line when available
   Issue: concise description
   Evidence: concise explanation
   Suggested fix: concise remediation

### Prior Issues Rechecked

1. Prior issue: description
   Status: fixed|not-fixed|unclear
   Evidence: concise explanation

### Review Notes

- Any limitations, skipped files, unavailable checkpoints, or assumptions.
```

## Main Agent Output

Present the CLI's consolidated findings to the developer:

- Itemized findings with severity and issue type.
- The `0/5` to `5/5` safety confidence score.
- Prior issue status when applicable.
- Any assumptions or limitations.

Do not fix issues during the review pass. Do not mutate code. Do not delete checkpoints unless the developer asks. Do not hide low-confidence findings; mark them clearly.

## Prior Review Issues

The CLI owns prior finding persistence and injects relevant unresolved findings into future specialist reviewers. The main agent does not need to manually pass prior issues between review runs.

If the developer mentions prior issues from outside the CLI database, pass them through `--review-stdin` so the CLI can parse them with Codex structured output, store them as external review findings, and route them to the relevant specialist reviewers. Do not manually route these findings to subagents.

To import external review Markdown:

```bash
cat other-review.md | pnpm --filter tiara-review exec tiara-review run --cwd "$PWD" --review-stdin
```

To reuse a specific database, pass:

```bash
pnpm --filter tiara-review exec tiara-review run --cwd "$PWD" --db <path>
```

The final report should include the CLI's `Prior Issues Rechecked` section when available.
