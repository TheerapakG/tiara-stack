import { fileURLToPath } from "url";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: fileURLToPath(new URL("src/schema.ts", import.meta.url)),
    zero: fileURLToPath(new URL("src/zero/index.ts", import.meta.url)),
  },
  sourcemap: true,
});
