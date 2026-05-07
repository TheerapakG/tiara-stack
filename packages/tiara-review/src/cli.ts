import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { Command, Flag } from "effect/unstable/cli";
import { runCheckpointedReview } from "./review/workflow";
import type { ReasoningEffort } from "./review/types";

const reasoningChoices = ["minimal", "low", "medium", "high", "xhigh"] as const;

class EmptyReviewStdin extends Data.TaggedError("EmptyReviewStdin")<{
  readonly message: string;
}> {}

class StdinReadFailed extends Data.TaggedError("StdinReadFailed")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export const readStdin = () =>
  Effect.tryPromise({
    try: () =>
      new Promise<string>((resolve, reject) => {
        const chunks: Array<Buffer> = [];
        process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
        process.stdin.on("error", reject);
        process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        process.stdin.resume();
      }),
    catch: (cause) =>
      new StdinReadFailed({
        message: cause instanceof Error ? cause.message : "Failed to read stdin",
        cause,
      }),
  });

const runCommand = Command.make(
  "run",
  {
    cwd: Flag.directory("cwd").pipe(Flag.withDefault(process.cwd())),
    model: Flag.string("model").pipe(Flag.optional),
    reasoning: Flag.choice("reasoning", reasoningChoices).pipe(Flag.withDefault("high" as const)),
    db: Flag.path("db").pipe(Flag.optional),
    json: Flag.boolean("json").pipe(Flag.withDefault(false)),
    timeoutMs: Flag.integer("timeout-ms").pipe(Flag.optional),
    reviewStdin: Flag.boolean("review-stdin").pipe(Flag.withDefault(false)),
  },
  (config) =>
    Effect.gen(function* () {
      const externalReviewMarkdown = config.reviewStdin ? yield* readStdin() : undefined;
      if (config.reviewStdin && externalReviewMarkdown?.trim().length === 0) {
        return yield* Effect.fail(
          new EmptyReviewStdin({
            message: "--review-stdin was provided but stdin was empty",
          }),
        );
      }
      const result = yield* runCheckpointedReview({
        cwd: config.cwd,
        dbPath: config.db._tag === "Some" ? config.db.value : undefined,
        model: config.model._tag === "Some" ? config.model.value : undefined,
        modelReasoningEffort: config.reasoning as ReasoningEffort,
        timeoutMs: config.timeoutMs._tag === "Some" ? config.timeoutMs.value : undefined,
        externalReviewMarkdown,
      });
      const externalReviewPrefix = result.externalReviewImport
        ? `External review import: ${result.externalReviewImport.importedFindingCount} findings imported; ${result.externalReviewImport.skippedFindingCount} skipped; ${result.externalReviewImport.warnings.length} warnings.\n\n`
        : "";
      yield* Console.log(
        config.json
          ? JSON.stringify(result, null, 2)
          : `${externalReviewPrefix}${result.reportMarkdown}`,
      );
    }),
).pipe(Command.withDescription("Run a checkpointed multi-agent Codex code review"));

export const command = Command.make("tiara-review").pipe(
  Command.withDescription("Checkpointed Codex code review CLI"),
  Command.withSubcommands([runCommand]),
);

export const main = Command.run(command, { version: "0.0.0" }).pipe(
  Effect.provide(NodeServices.layer),
);

export const runMain = () => NodeRuntime.runMain(main as Effect.Effect<void, unknown>);
