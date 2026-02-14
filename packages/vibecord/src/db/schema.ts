import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import path from "path";
import os from "os";
import fs from "fs";

export const getDbPath = () => {
  const vibecordDir = path.join(os.homedir(), ".vibecord");
  if (!fs.existsSync(vibecordDir)) {
    fs.mkdirSync(vibecordDir, { recursive: true });
  }
  return path.join(vibecordDir, "vibecord.db");
};

export const workspace = sqliteTable("workspace", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  cwd: text("cwd").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  threadId: text("thread_id").notNull(),
  acpSessionId: text("acp_session_id").notNull(),
  worktreePath: text("worktree_path"),
  model: text("model"),
  mode: text("mode"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const buttonMapping = sqliteTable("button_mapping", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buttonId: text("button_id").notNull().unique(),
  sessionId: text("session_id").notNull(),
  requestId: text("request_id").notNull(),
  optionValue: text("option_value").notNull(),
  userId: text("user_id"), // Discord user ID for authorization
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});
