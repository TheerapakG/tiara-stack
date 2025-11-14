import path from "pathe";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: path.resolve(__dirname, "src/schema.ts"),
    zero: path.resolve(__dirname, "src/zero/index.ts"),
  },
  sourcemap: true,
});
