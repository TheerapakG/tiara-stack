import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repo = mkdtempSync(join(tmpdir(), "tiara-review-dist-worker."));
const dbDir = mkdtempSync(join(tmpdir(), "tiara-review-dist-worker-db."));

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

  const output = execFileSync(
    process.execPath,
    ["dist/index.mjs", "graph", "build", "--cwd", repo, "--db", join(dbDir, "reviews.sqlite")],
    { cwd: packageRoot, encoding: "utf8" },
  );
  const version = JSON.parse(output);
  if (version.status !== "completed") {
    throw new Error(`Expected completed graph version, received ${version.status}`);
  }
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(dbDir, { recursive: true, force: true });
}
