import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import {
  resolveRepoRoot,
  captureCheckpoint,
  deleteCheckpointRef,
  determineReviewBaseFromCompletedCheckpoint,
  getCurrentBranch,
} from "../git/checkpoint";
import { getDiffInfo } from "../git/diff";
import {
  consolidatedOutputSchema,
  decodeConsolidatedOutput,
  decodeSpecialistOutput,
  SdkCodexReviewClient,
  specialistOutputSchema,
  type CodexReviewClient,
} from "../codex/client";
import { groupedPriorFindings, makeId, ReviewRepository } from "../db/repository";
import { defaultDbPath } from "../config";
import { makeOrchestratorPrompt, makeSpecialistPrompt } from "./prompts";
import { renderReviewReport } from "./report";
import {
  type ReviewAspect,
  type ReviewRunConfig,
  type ReviewRunRecord,
  type ReviewRunResult,
  type SpecialistReviewOutput,
  type ExternalReviewImportResult,
  type FindingSource,
  type ReviewFinding,
  CodexAgentFailed,
  CodexAgentTimedOut,
  OrchestratorFailed,
  reviewAspects,
  type AgentStatus,
} from "./types";
import { parseExternalReviewWithCodex } from "./external-review";

const now = () => Math.floor(Date.now() / 1000);

const agentFailureStatus = (cause: Cause.Cause<unknown>): AgentStatus => {
  const error = Cause.findErrorOption(cause);
  return Option.isSome(error) && error.value instanceof CodexAgentTimedOut ? "timed-out" : "failed";
};

export const runCheckpointedReviewWithClient = (
  config: ReviewRunConfig,
  client: CodexReviewClient,
) =>
  Effect.gen(function* () {
    const repoRoot = yield* resolveRepoRoot(config.cwd);
    const repository = yield* ReviewRepository;
    const checkpoint = yield* captureCheckpoint(repoRoot);
    const runAfterCheckpoint = Effect.gen(function* () {
      const branch = yield* getCurrentBranch(repoRoot);
      const priorCheckpoint = yield* repository.run(
        repository.loadLatestCompletedCheckpoint(repoRoot, branch),
      );
      const base = yield* determineReviewBaseFromCompletedCheckpoint(
        repoRoot,
        checkpoint,
        priorCheckpoint,
      );
      const diffInfo = yield* getDiffInfo(repoRoot, base, checkpoint);
      const runId = makeId();
      const createdAt = now();
      const runRecord = {
        id: runId,
        repoRoot,
        branch,
        headCommit: checkpoint.headCommit,
        baseRef: base.baseRef,
        baseCommit: base.baseCommit,
        checkpointRef: checkpoint.checkpointRef,
        checkpointCommit: checkpoint.checkpointCommit,
        checkpointCreatedAtMillis: checkpoint.createdAt,
        diffHash: diffInfo.diffHash,
        diffStatJson: JSON.stringify(diffInfo.stat),
        createdAt,
        status: "running",
      } satisfies ReviewRunRecord;

      yield* repository.run(repository.insertRun(runRecord));
      const completeRunOnError = (cause: Cause.Cause<unknown>) =>
        repository
          .run(
            repository.completeRun({
              runId,
              status: "failed",
              completedAt: now(),
              error: String(cause),
            }),
          )
          .pipe(Effect.ignore);
      const markAgentFailed = (input: {
        readonly agentId: string;
        readonly status: AgentStatus;
        readonly error: string;
        readonly codexThreadId?: string | null;
      }) =>
        repository.run(
          repository.updateAgent({
            id: input.agentId,
            status: input.status,
            codexThreadId: input.codexThreadId,
            completedAt: now(),
            error: input.error,
          }),
        );
      const failWithAgentFailureAndMarkFailure = (
        agentCause: Cause.Cause<unknown>,
        markCause: Cause.Cause<unknown>,
      ) => Effect.failCause(Cause.combine(agentCause, markCause));
      const persistCompletedAgentFindings = (input: {
        readonly agentId: string;
        readonly source: FindingSource;
        readonly threadId: string | null;
        readonly findings: ReadonlyArray<ReviewFinding>;
      }) =>
        Effect.gen(function* () {
          yield* repository.run(
            repository.updateAgent({
              id: input.agentId,
              status: "completed",
              codexThreadId: input.threadId,
              completedAt: now(),
            }),
          );
          yield* repository.run(
            repository.insertFindings({
              runId,
              agentId: input.agentId,
              source: input.source,
              findings: input.findings,
            }),
          );
        });
      const reviewExecution = Effect.gen(function* () {
        const externalReviewMarkdown = config.externalReviewMarkdown;
        const externalReviewImport: ExternalReviewImportResult | undefined =
          externalReviewMarkdown && externalReviewMarkdown.trim().length > 0
            ? yield* Effect.gen(function* () {
                const parserAgentId = makeId();
                yield* repository.run(
                  repository.insertAgent({
                    id: parserAgentId,
                    runId,
                    aspect: "external-review-parser",
                    status: "running",
                    startedAt: now(),
                  }),
                );
                const parserExit = yield* Effect.exit(
                  parseExternalReviewWithCodex(
                    {
                      markdown: externalReviewMarkdown,
                      repoRoot,
                      model: config.model,
                      modelReasoningEffort: config.modelReasoningEffort ?? "high",
                      timeoutMs: config.timeoutMs,
                    },
                    client,
                  ),
                );
                if (Exit.isFailure(parserExit)) {
                  const error = String(parserExit.cause);
                  const failureUpdateExit = yield* Effect.exit(
                    markAgentFailed({
                      agentId: parserAgentId,
                      status: agentFailureStatus(parserExit.cause),
                      error,
                    }),
                  );
                  if (Exit.isFailure(failureUpdateExit)) {
                    return yield* failWithAgentFailureAndMarkFailure(
                      parserExit.cause,
                      failureUpdateExit.cause,
                    );
                  }
                  return yield* Effect.failCause(parserExit.cause);
                }
                const persistenceExit = yield* Effect.exit(
                  persistCompletedAgentFindings({
                    agentId: parserAgentId,
                    source: "external-review",
                    threadId: parserExit.value.threadId,
                    findings: parserExit.value.findings,
                  }),
                );
                if (Exit.isFailure(persistenceExit)) {
                  const failureUpdateExit = yield* Effect.exit(
                    markAgentFailed({
                      agentId: parserAgentId,
                      status: "failed",
                      codexThreadId: parserExit.value.threadId,
                      error: `Failed to persist external review parser result: ${String(persistenceExit.cause)}`,
                    }),
                  );
                  if (Exit.isFailure(failureUpdateExit)) {
                    return yield* failWithAgentFailureAndMarkFailure(
                      persistenceExit.cause,
                      failureUpdateExit.cause,
                    );
                  }
                  return yield* Effect.failCause(persistenceExit.cause);
                }
                return {
                  importedFindingCount: parserExit.value.findings.length,
                  skippedFindingCount: parserExit.value.skippedFindingCount,
                  warnings: parserExit.value.warnings,
                  codexThreadId: parserExit.value.threadId,
                } satisfies ExternalReviewImportResult;
              })
            : undefined;

        const priorFindings = yield* repository.run(
          repository.loadReviewInputFindings({ repoRoot, currentRunId: runId }),
        );
        const priorByAspect = groupedPriorFindings(priorFindings);

        const reviewerEffects = reviewAspects.map((aspect) =>
          Effect.gen(function* () {
            const agentId = makeId();
            yield* repository.run(
              repository.insertAgent({
                id: agentId,
                runId,
                aspect,
                status: "running",
                startedAt: now(),
              }),
            );
            const prompt = makeSpecialistPrompt({
              aspect,
              baseRef: base.baseRef,
              checkpointRef: checkpoint.checkpointRef,
              checkpointCommit: checkpoint.checkpointCommit,
              diffText: diffInfo.diffText,
              priorFindings: priorByAspect[aspect],
            });
            const resultExit = yield* Effect.exit(
              client
                .runStructured<unknown>(prompt, {
                  aspect,
                  repoRoot,
                  model: config.model,
                  modelReasoningEffort: config.modelReasoningEffort ?? "high",
                  timeoutMs: config.timeoutMs,
                  outputSchema: specialistOutputSchema,
                })
                .pipe(
                  Effect.flatMap((result) =>
                    decodeSpecialistOutput(aspect, result.output).pipe(
                      Effect.map((output) => ({ output, threadId: result.threadId })),
                    ),
                  ),
                ),
            );
            if (Exit.isFailure(resultExit)) {
              const failureUpdateExit = yield* Effect.exit(
                markAgentFailed({
                  agentId,
                  status: agentFailureStatus(resultExit.cause),
                  error: String(resultExit.cause),
                }),
              );
              if (Exit.isFailure(failureUpdateExit)) {
                return yield* failWithAgentFailureAndMarkFailure(
                  resultExit.cause,
                  failureUpdateExit.cause,
                );
              }
              return { aspect, agentId, output: null, failed: true as const };
            }
            const persistenceExit = yield* Effect.exit(
              persistCompletedAgentFindings({
                agentId,
                source: "specialist",
                threadId: resultExit.value.threadId,
                findings: resultExit.value.output.findings,
              }),
            );
            if (Exit.isFailure(persistenceExit)) {
              const failureUpdateExit = yield* Effect.exit(
                markAgentFailed({
                  agentId,
                  status: "failed",
                  codexThreadId: resultExit.value.threadId,
                  error: `Failed to persist reviewer result: ${String(persistenceExit.cause)}`,
                }),
              );
              if (Exit.isFailure(failureUpdateExit)) {
                return yield* failWithAgentFailureAndMarkFailure(
                  persistenceExit.cause,
                  failureUpdateExit.cause,
                );
              }
              return yield* Effect.failCause(persistenceExit.cause);
            }
            return { aspect, agentId, output: resultExit.value.output, failed: false as const };
          }),
        );

        const reviewerResults = yield* Effect.all(reviewerEffects, { concurrency: "unbounded" });
        const successfulOutputs = reviewerResults
          .filter(
            (
              result,
            ): result is typeof result & {
              readonly output: SpecialistReviewOutput;
              readonly failed: false;
            } => !result.failed,
          )
          .map((result) => result.output);
        const failedAspects = reviewerResults
          .filter((result) => result.failed)
          .map((result) => result.aspect as ReviewAspect);

        const orchestratorAgentId = makeId();
        yield* repository.run(
          repository.insertAgent({
            id: orchestratorAgentId,
            runId,
            aspect: "orchestrator",
            status: "running",
            startedAt: now(),
          }),
        );
        const orchestratorPrompt = makeOrchestratorPrompt({
          baseRef: base.baseRef,
          checkpointRef: checkpoint.checkpointRef,
          diffInfo,
          reviewerOutputs: successfulOutputs,
          failedAspects,
        });
        const orchestratorExit = yield* Effect.exit(
          client
            .runStructured<unknown>(orchestratorPrompt, {
              aspect: "orchestrator",
              repoRoot,
              model: config.model,
              modelReasoningEffort: config.modelReasoningEffort ?? "high",
              timeoutMs: config.timeoutMs,
              outputSchema: consolidatedOutputSchema,
            })
            .pipe(
              Effect.flatMap((result) =>
                decodeConsolidatedOutput("orchestrator", result.output).pipe(
                  Effect.map((output) => ({ output, threadId: result.threadId })),
                ),
              ),
            ),
        );

        if (Exit.isFailure(orchestratorExit)) {
          const error = String(orchestratorExit.cause);
          const failureUpdateExit = yield* Effect.exit(
            markAgentFailed({
              agentId: orchestratorAgentId,
              status: agentFailureStatus(orchestratorExit.cause),
              error,
            }),
          );
          if (Exit.isFailure(failureUpdateExit)) {
            return yield* failWithAgentFailureAndMarkFailure(
              orchestratorExit.cause,
              failureUpdateExit.cause,
            );
          }
          return yield* Effect.fail(
            new OrchestratorFailed({
              message: "Orchestrator failed",
              cause: orchestratorExit.cause,
            }),
          );
        }

        const consolidated = orchestratorExit.value.output;
        const reportMarkdown = renderReviewReport(consolidated);
        const orchestratorPersistenceExit = yield* Effect.exit(
          repository.run(
            repository.completeOrchestratorRun({
              runId,
              agentId: orchestratorAgentId,
              threadId: orchestratorExit.value.threadId,
              findings: consolidated.issues,
              rechecks: consolidated.priorIssuesRechecked,
              completedAt: now(),
              safetyConfidence: consolidated.safetyConfidence,
              reportMarkdown,
              reportJson: JSON.stringify(consolidated),
            }),
          ),
        );
        if (Exit.isFailure(orchestratorPersistenceExit)) {
          const failureUpdateExit = yield* Effect.exit(
            markAgentFailed({
              agentId: orchestratorAgentId,
              status: "failed",
              codexThreadId: orchestratorExit.value.threadId,
              error: `Failed to persist orchestrator result: ${String(orchestratorPersistenceExit.cause)}`,
            }),
          );
          if (Exit.isFailure(failureUpdateExit)) {
            return yield* failWithAgentFailureAndMarkFailure(
              orchestratorPersistenceExit.cause,
              failureUpdateExit.cause,
            );
          }
          return yield* Effect.failCause(orchestratorPersistenceExit.cause);
        }

        return {
          runId,
          baseReviewed: consolidated.baseReviewed,
          checkpointRef: checkpoint.checkpointRef,
          checkpointCommit: checkpoint.checkpointCommit,
          safetyConfidence: consolidated.safetyConfidence,
          findings: consolidated.issues,
          reportMarkdown,
          failedAspects,
          externalReviewImport,
        } satisfies ReviewRunResult;
      });
      return yield* reviewExecution.pipe(Effect.onError(completeRunOnError));
    });
    return yield* runAfterCheckpoint.pipe(
      Effect.onError(() =>
        deleteCheckpointRef(repoRoot, checkpoint.checkpointRef).pipe(Effect.ignore),
      ),
    );
  }).pipe(Effect.provide(ReviewRepository.layer(config.dbPath ?? defaultDbPath())));

export const runCheckpointedReview = (config: ReviewRunConfig) =>
  Effect.try({
    try: () => new SdkCodexReviewClient(),
    catch: (cause) =>
      new CodexAgentFailed({
        aspect: "orchestrator",
        message: cause instanceof Error ? cause.message : "Unable to initialize Codex SDK client",
        cause,
      }),
  }).pipe(Effect.flatMap((client) => runCheckpointedReviewWithClient(config, client)));
