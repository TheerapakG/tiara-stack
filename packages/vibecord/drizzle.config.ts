import { type Config } from "drizzle-kit";
import os from "os";
import path from "path";
import fs from "fs";

const getDbPath = () => {
  const vibecordDir = path.join(os.homedir(), ".vibecord");
  if (!fs.existsSync(vibecordDir)) {
    fs.mkdirSync(vibecordDir, { recursive: true });
  }
  return path.join(vibecordDir, "vibecord.db");
};

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: getDbPath(),
  },
  strict: true,
} satisfies Config;
