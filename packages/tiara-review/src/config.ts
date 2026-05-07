import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import * as Effect from "effect/Effect";
import { DatabaseOpenFailed } from "./review/types";

export const defaultDataDir = () => {
  const xdgDataHome = process.env["XDG_DATA_HOME"];
  return xdgDataHome
    ? join(xdgDataHome, "tiara-review")
    : join(homedir(), ".local", "share", "tiara-review");
};

export const defaultDbPath = () => join(defaultDataDir(), "reviews.sqlite");

export const ensureDbDirectory = (dbPath: string) =>
  Effect.tryPromise({
    try: () => mkdir(dirname(dbPath), { recursive: true }),
    catch: (cause) => new DatabaseOpenFailed({ dbPath, cause }),
  });
