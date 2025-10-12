import path from "pathe";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: path.resolve(__dirname, "src/schema.ts") },
});
