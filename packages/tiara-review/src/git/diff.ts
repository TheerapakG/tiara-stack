import { createHash } from "node:crypto";
import * as Effect from "effect/Effect";
import { type DiffInfo, type ReviewBase, type Checkpoint } from "../review/types";
import { gitText } from "./checkpoint";

const parseNumstat = (output: string) =>
  output
    .split("\n")
    .filter(Boolean)
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const [insertions = "0", deletions = "0", ...pathParts] = line.split("\t");
      return {
        path: pathParts.join("\t"),
        insertions: insertions === "-" ? 0 : Number(insertions),
        deletions: deletions === "-" ? 0 : Number(deletions),
      };
    });

const parseDiffMetadata = (output: string) => {
  const lines = output.split("\n").filter(Boolean);
  let summary = "";
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line && !line.includes("\t")) {
      summary = line.trim();
      break;
    }
  }
  const files = parseNumstat(output);
  return {
    changedFiles: files.map((file) => file.path),
    stat: {
      files,
      summary,
    },
  };
};

export const getDiffInfo = (repoRoot: string, base: ReviewBase, checkpoint: Checkpoint) =>
  Effect.gen(function* () {
    const diffText = yield* gitText(repoRoot, [
      "diff",
      "--find-renames",
      "--find-copies",
      base.baseRef,
      checkpoint.checkpointCommit,
    ]);
    const metadata = yield* gitText(repoRoot, [
      "diff",
      "--numstat",
      "--shortstat",
      "--find-renames",
      "--find-copies",
      base.baseRef,
      checkpoint.checkpointCommit,
    ]).pipe(Effect.map(parseDiffMetadata));
    return {
      diffText,
      diffHash: createHash("sha256").update(diffText).digest("hex"),
      changedFiles: metadata.changedFiles,
      stat: metadata.stat,
    } satisfies DiffInfo;
  });
