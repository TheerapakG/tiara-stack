import path from "pathe";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: path.resolve(__dirname, "src/index.ts") },
  format: "umd",
  target: "es6",
  outputOptions: { name: "sheetFormulas" },
  noExternal: [/^.*$/],
});
