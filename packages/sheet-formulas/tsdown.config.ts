import { fileURLToPath } from "url";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: fileURLToPath(new URL("src/index.ts", import.meta.url)) },
  sourcemap: true,
  format: "umd",
  outputOptions: { name: "sheetFormulas" },
  target: "es6",
  minify: true,
  noExternal: [/^.*$/],
});
