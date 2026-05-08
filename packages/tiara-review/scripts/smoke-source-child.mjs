import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractDependencyGraphAsync } from "../src/graph/extract.ts";

const repo = mkdtempSync(join(tmpdir(), "tiara-review-source-child."));
const git = (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trimEnd();

try {
  git(["init"]);
  git(["config", "user.name", "Test User"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "commit.gpgsign", "false"]);
  writeFileSync(
    join(repo, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", strict: true } }),
  );
  writeFileSync(
    join(repo, "source.ts"),
    `export function value() {
  return 1;
}

export const loadValue = () => value();
`,
  );
  git(["add", "."]);
  git(["commit", "-m", "initial"]);

  const graph = await extractDependencyGraphAsync(repo);
  if (!graph.symbols.some((symbol) => symbol.name === "loadValue")) {
    throw new Error("Expected source-child extraction to find loadValue");
  }
} finally {
  rmSync(repo, { recursive: true, force: true });
}
