#!/usr/bin/env -S pnpm exec tsx
/// <reference types="node" />

import { Schema } from "effect";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const envFileIndex = process.argv.indexOf("--env-file");
const envFile = (() => {
  if (envFileIndex === -1) return "deploy/compose/.env";
  const candidate = process.argv[envFileIndex + 1];
  if (!candidate || candidate.startsWith("--")) {
    throw new Error("--env-file requires a path");
  }
  return candidate;
})();
const dryRun = process.argv.includes("--dry-run");

const EnvFileSchema = Schema.Struct({
  POSTGRES_PASSWORD: Schema.NonEmptyString,
  POSTGRES_PORT: Schema.optional(Schema.String),
});

const parseEnvFile = (path: string) => {
  const resolved = resolve(repoRoot, path);
  if (!existsSync(resolved)) {
    throw new Error(
      `Env file not found at ${resolved}. Run \`pnpm compose:generate-secrets\` first.`,
    );
  }
  const contents = readFileSync(resolved, "utf8");
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    values[key] = /^(['"]).*\1$/.test(rawValue)
      ? rawValue.replace(/^(['"])(.*)\1$/, "$2")
      : rawValue;
  }

  return Schema.decodeUnknownSync(EnvFileSchema)(values);
};

const env = {
  ...process.env,
  ...parseEnvFile(envFile),
};

const postgresPassword = env.POSTGRES_PASSWORD;
const postgresPort = env.POSTGRES_PORT || "5432";
const postgresPortNumber = Number(postgresPort);
if (!Number.isInteger(postgresPortNumber) || postgresPortNumber < 1 || postgresPortNumber > 65535) {
  throw new Error(`${envFile} POSTGRES_PORT must be an integer between 1 and 65535`);
}
const postgresUrl = `postgres://tiara:${encodeURIComponent(postgresPassword)}@localhost:${postgresPort}/tiara`;

if (dryRun) {
  console.log("Would run: pnpm --filter sheet-db-schema db:migrate");
  console.log(`Using Postgres: localhost:${postgresPort}/tiara`);
  process.exit(0);
}

const child = spawn("pnpm", ["--filter", "sheet-db-schema", "db:migrate"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    POSTGRES_URL: postgresUrl,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

const signalHandlers = new Map<NodeJS.Signals, () => void>();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  const handler = () => {
    child.kill(signal);
  };
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
}

const removeSignalHandlers = () => {
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler);
  }
};

child.on("error", (error) => {
  removeSignalHandlers();
  console.error(`Failed to start migration: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  removeSignalHandlers();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
