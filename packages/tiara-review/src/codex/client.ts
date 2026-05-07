import { Codex, type ModelReasoningEffort, type ThreadOptions } from "@openai/codex-sdk";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  type AgentAspect,
  type ConsolidatedReview,
  type ReasoningEffort,
  type SpecialistReviewOutput,
  CodexAgentFailed,
  CodexAgentTimedOut,
  InvalidAgentOutput,
} from "../review/types";

const defaultTimeoutCleanupGraceMs = 5_000;

export type CodexRunOptions = {
  readonly aspect: AgentAspect;
  readonly repoRoot: string;
  readonly model?: string;
  readonly modelReasoningEffort?: ReasoningEffort;
  readonly timeoutMs?: number;
  readonly outputSchema: unknown;
};

export type CodexRunResult<A> = {
  readonly threadId: string | null;
  readonly output: A;
};

export interface CodexReviewClient {
  readonly runStructured: <A>(
    prompt: string,
    options: CodexRunOptions,
  ) => Effect.Effect<CodexRunResult<A>, CodexAgentFailed | CodexAgentTimedOut | InvalidAgentOutput>;
}

const parseJson = <A>(aspect: AgentAspect, text: string) =>
  Effect.try({
    try: () => JSON.parse(text) as A,
    catch: () =>
      new InvalidAgentOutput({
        aspect,
        message: "Codex response was not valid JSON",
        output: text,
      }),
  });

export const runWithAbortTimeout = <A>(input: {
  readonly runPromise: Promise<A>;
  readonly abort: () => void;
  readonly timeoutMs?: number;
  readonly cleanupGraceMs?: number;
  readonly timeoutError: () => CodexAgentTimedOut;
}) => {
  if (!input.timeoutMs) {
    return input.runPromise;
  }
  return new Promise<A>((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      input.abort();
      const cleanupTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(input.timeoutError());
        }
      }, input.cleanupGraceMs ?? defaultTimeoutCleanupGraceMs);
      void input.runPromise.then(
        () => {
          if (!settled) {
            settled = true;
            clearTimeout(cleanupTimeout);
            reject(input.timeoutError());
          }
        },
        () => {
          if (!settled) {
            settled = true;
            clearTimeout(cleanupTimeout);
            reject(input.timeoutError());
          }
        },
      );
    }, input.timeoutMs);
    input.runPromise.then(
      (value) => {
        if (!timedOut && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(value);
        }
      },
      (cause) => {
        if (!timedOut && !settled) {
          settled = true;
          clearTimeout(timeout);
          reject(cause);
        }
      },
    );
  });
};

export class SdkCodexReviewClient implements CodexReviewClient {
  private readonly codex: Codex;

  constructor() {
    this.codex = new Codex();
  }

  runStructured<A>(prompt: string, options: CodexRunOptions) {
    return Effect.tryPromise({
      try: async () => {
        const abortController = new AbortController();
        const threadOptions: ThreadOptions = {
          workingDirectory: options.repoRoot,
          sandboxMode: "read-only",
          approvalPolicy: "never",
          webSearchMode: "disabled",
          networkAccessEnabled: false,
          model: options.model,
          modelReasoningEffort: options.modelReasoningEffort as ModelReasoningEffort | undefined,
        };
        const thread = this.codex.startThread(threadOptions);
        const runPromise = thread.run(prompt, {
          outputSchema: options.outputSchema,
          signal: abortController.signal,
        });
        const turn = await runWithAbortTimeout({
          runPromise,
          abort: () => abortController.abort(),
          timeoutMs: options.timeoutMs,
          timeoutError: () =>
            new CodexAgentTimedOut({
              aspect: options.aspect,
              timeoutMs: options.timeoutMs ?? 0,
            }),
        });
        return {
          threadId: thread.id,
          text: turn.finalResponse,
        };
      },
      catch: (cause) =>
        cause instanceof CodexAgentTimedOut
          ? cause
          : cause instanceof DOMException && cause.name === "AbortError" && options.timeoutMs
            ? new CodexAgentTimedOut({ aspect: options.aspect, timeoutMs: options.timeoutMs })
            : new CodexAgentFailed({
                aspect: options.aspect,
                message: cause instanceof Error ? cause.message : "Codex agent failed",
                cause,
              }),
    }).pipe(
      Effect.flatMap(({ threadId, text }) =>
        parseJson<A>(options.aspect, text).pipe(
          Effect.map((output) => ({
            threadId,
            output,
          })),
        ),
      ),
    );
  }
}

export const SeveritySchema = Schema.Union([
  Schema.Literal("high"),
  Schema.Literal("medium"),
  Schema.Literal("low"),
]);
export const FindingTypeSchema = Schema.Union([
  Schema.Literal("security"),
  Schema.Literal("code-quality"),
  Schema.Literal("logic-bug"),
  Schema.Literal("race-condition"),
  Schema.Literal("test-flakiness"),
  Schema.Literal("maintainability"),
]);
export const FindingSchema = Schema.Struct({
  severity: SeveritySchema,
  type: FindingTypeSchema,
  location: Schema.NullOr(Schema.String),
  issue: Schema.String,
  evidence: Schema.String,
  suggestedFix: Schema.String,
});
const PriorIssueRecheckSchema = Schema.Struct({
  priorIssue: Schema.String,
  priorFindingId: Schema.NullOr(Schema.String),
  status: Schema.Union([
    Schema.Literal("fixed"),
    Schema.Literal("not-fixed"),
    Schema.Literal("unclear"),
  ]),
  evidence: Schema.String,
});

export const findingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["severity", "type", "location", "issue", "evidence", "suggestedFix"],
  properties: {
    severity: { type: "string", enum: ["high", "medium", "low"] },
    type: {
      type: "string",
      enum: [
        "security",
        "code-quality",
        "logic-bug",
        "race-condition",
        "test-flakiness",
        "maintainability",
      ],
    },
    location: { type: ["string", "null"] },
    issue: { type: "string" },
    evidence: { type: "string" },
    suggestedFix: { type: "string" },
  },
} as const;

const priorIssueRecheckJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["priorIssue", "priorFindingId", "status", "evidence"],
  properties: {
    priorIssue: { type: "string" },
    priorFindingId: { type: ["string", "null"] },
    status: { type: "string", enum: ["fixed", "not-fixed", "unclear"] },
    evidence: { type: "string" },
  },
} as const;

export const specialistOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["aspect", "findings", "priorIssuesRechecked", "contextUsed", "markdown"],
  properties: {
    aspect: {
      type: "string",
      enum: [
        "security",
        "code-quality",
        "logic-bugs",
        "race-conditions",
        "test-flakiness",
        "maintainability",
      ],
    },
    findings: { type: "array", items: findingJsonSchema },
    priorIssuesRechecked: { type: "array", items: priorIssueRecheckJsonSchema },
    contextUsed: {
      type: "object",
      additionalProperties: false,
      required: ["baseReviewed", "currentCheckpoint", "extraContextInspected"],
      properties: {
        baseReviewed: { type: "string" },
        currentCheckpoint: { type: "string" },
        extraContextInspected: { type: "string" },
      },
    },
    markdown: { type: "string" },
  },
};

export const consolidatedOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "baseReviewed",
    "currentCheckpoint",
    "safetyConfidence",
    "issues",
    "priorIssuesRechecked",
    "reviewNotes",
  ],
  properties: {
    baseReviewed: { type: "string" },
    currentCheckpoint: { type: "string" },
    safetyConfidence: { type: "integer", minimum: 0, maximum: 5 },
    issues: { type: "array", items: findingJsonSchema },
    priorIssuesRechecked: { type: "array", items: priorIssueRecheckJsonSchema },
    reviewNotes: { type: "array", items: { type: "string" } },
  },
};

export const decodeSpecialistOutput = (aspect: AgentAspect, input: unknown) =>
  Schema.decodeUnknownEffect(
    Schema.Struct({
      aspect: Schema.Union([
        Schema.Literal("security"),
        Schema.Literal("code-quality"),
        Schema.Literal("logic-bugs"),
        Schema.Literal("race-conditions"),
        Schema.Literal("test-flakiness"),
        Schema.Literal("maintainability"),
      ]),
      findings: Schema.Array(FindingSchema),
      priorIssuesRechecked: Schema.Array(PriorIssueRecheckSchema),
      contextUsed: Schema.Struct({
        baseReviewed: Schema.String,
        currentCheckpoint: Schema.String,
        extraContextInspected: Schema.String,
      }),
      markdown: Schema.String,
    }),
  )(input).pipe(
    Effect.mapError(
      (cause) =>
        new InvalidAgentOutput({ aspect, message: String(cause), output: JSON.stringify(input) }),
    ),
    Effect.flatMap((output) =>
      output.aspect === aspect
        ? Effect.succeed(output)
        : Effect.fail(
            new InvalidAgentOutput({
              aspect,
              message: `Specialist returned aspect ${output.aspect} for assigned aspect ${aspect}`,
              output: JSON.stringify(input),
            }),
          ),
    ),
  ) as Effect.Effect<SpecialistReviewOutput, InvalidAgentOutput>;

export const decodeConsolidatedOutput = (aspect: AgentAspect, input: unknown) =>
  Schema.decodeUnknownEffect(
    Schema.Struct({
      baseReviewed: Schema.String,
      currentCheckpoint: Schema.String,
      safetyConfidence: Schema.Union([
        Schema.Literal(0),
        Schema.Literal(1),
        Schema.Literal(2),
        Schema.Literal(3),
        Schema.Literal(4),
        Schema.Literal(5),
      ]),
      issues: Schema.Array(FindingSchema),
      priorIssuesRechecked: Schema.Array(PriorIssueRecheckSchema),
      reviewNotes: Schema.Array(Schema.String),
    }),
  )(input).pipe(
    Effect.mapError(
      (cause) =>
        new InvalidAgentOutput({ aspect, message: String(cause), output: JSON.stringify(input) }),
    ),
  ) as Effect.Effect<ConsolidatedReview, InvalidAgentOutput>;
