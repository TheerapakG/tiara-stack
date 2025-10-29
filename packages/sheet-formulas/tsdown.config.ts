import path from "pathe";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: path.resolve(__dirname, "src/index.ts") },
  sourcemap: true,
  format: "umd",
  outputOptions: { name: "sheetFormulas" },
  target: "es6",
  minify: true,
  noExternal: [/^.*$/],
});
