import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const dbPath = schema.getDbPath();
    const sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export { schema };
