---
name: checkpointed-code-review
description: Run a checkpointed multi-agent code review over recent working-directory changes, with specialist reviewers for security, quality, bugs, races, test flakiness, and maintainability.
---

# Checkpointed Code Review

Use this skill when the developer asks for a checkpointed code review, a multi-agent review of current changes, or explicitly invokes `$checkpointed-code-review`.

Checkpointing means a hidden Git-ref snapshot mechanism: capture the full working directory into a synthetic commit via a temporary index, store it under a hidden ref, and diff it against the prior checkpoint or `HEAD`, whichever is more recent. A normal checked-out Git repository directory is sufficient; no separate `git worktree` checkout is required.

## Main Agent Workflow

1. Spawn one review orchestrator sub-agent.
2. Tell the orchestrator to first create a checkpoint for the current working directory using `scripts/capture_checkpoint.sh`.
3. Provide the orchestrator any unresolved prior-review issues from earlier turns that have not been reviewed as fixed.
4. Wait for the orchestrator's final report.
5. Return the issues and safety confidence score to the developer.
6. Do not fix anything unless the developer explicitly asks for fixes.
7. If the developer explicitly requests a review loop, repeat review/fix/review as instructed; otherwise run one review pass only.
8. After reporting, tell the developer if checkpoint refs were retained; prune them only when the developer asks.

If sub-agent spawning is unavailable in the current runtime, state that limitation and perform a best-effort single-agent review using the same six review categories and output contract.

## Checkpoint Helper

Use `scripts/capture_checkpoint.sh` from this skill directory to capture the current working-directory checkpoint.

The helper:

- Must be run inside a Git working tree: a normal checked-out repository directory is sufficient.
- Does not require a separate `git worktree` checkout.
- Uses a temporary Git index via `GIT_INDEX_FILE`.
- If `HEAD` exists, initializes the temporary index with `git read-tree HEAD`.
- Adds tracked changes and unignored untracked files with `git add -A -- .`; gitignored files are excluded from the checkpoint.
- Creates a tree with `git write-tree`.
- Creates a synthetic commit with `git commit-tree`, using `HEAD` as parent when `HEAD` exists.
- Stores it with `git update-ref`.
- Prints `checkpoint_ref`, `checkpoint_commit`, `head_commit`, `created_at`, and `working_dir_only=true`.
- Captures on-disk working-directory state, not staged-only index state such as partial staging or `git rm --cached`.

The helper must not modify the current branch, modify the user's real index, commit to the checked-out branch, restore files, or clean files.

## Checkpoint Retention

Checkpoint refs are persistent Git refs under `refs/tiara-review-checkpoints/`. Keep them during the review so later passes can compare against the prior checkpoint. Do not delete checkpoint refs automatically unless the developer asks.

When asked to prune stale checkpoints, keep the most recent 20 refs and delete older refs with `git update-ref -d <ref>`. Use `git for-each-ref --sort=-committerdate --format='%(refname)' refs/tiara-review-checkpoints/` to list refs newest first before deleting.

## Orchestrator Responsibilities

The orchestrator must:

1. Capture the current working-directory checkpoint.
2. Determine the review base:
   - The prior checkpoint is the most-recently-created ref under `refs/tiara-review-checkpoints/`, excluding the checkpoint just captured. Determine it with `git for-each-ref --sort=-committerdate --format='%(refname)' refs/tiara-review-checkpoints/` and take the first ref that is not the current checkpoint.
   - Prefer the prior review checkpoint if it exists and is newer than the latest commit by wall-clock commit time.
   - Compare the prior checkpoint timestamp with `git show -s --format=%ct <prior-checkpoint-ref>` or its recorded `created_at`; compare `HEAD` with `git log -1 --format=%ct HEAD`.
   - Otherwise use `HEAD`.
   - If uncertain, use `HEAD` and state that assumption.
3. Generate the initial diff between the base and current checkpoint.
4. Spawn six specialist reviewer sub-agents:
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
   - Relevant unresolved prior issues for that aspect.
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

Present the orchestrator's consolidated findings to the developer:

- Itemized findings with severity and issue type.
- The `0/5` to `5/5` safety confidence score.
- Prior issue status when applicable.
- Any assumptions or limitations.

Do not fix issues during the review pass. Do not mutate code. Do not delete checkpoints unless the developer asks. Do not hide low-confidence findings; mark them clearly.

## Prior Review Issues

If the main agent has run this skill before in the conversation, pass unresolved issues to the orchestrator. Include:

- Original issue text.
- Severity.
- Type.
- Location.
- Whether it was previously claimed fixed.
- Relevant checkpoint/base refs from the earlier review, when available.

The orchestrator should route each prior issue to the most relevant specialist reviewer and include the recheck result in the final report.
