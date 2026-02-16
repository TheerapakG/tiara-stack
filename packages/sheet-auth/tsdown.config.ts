import { defineConfig } from "tsdown";
import { fileURLToPath } from "url";

export default defineConfig({
  entry: {
    index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    subjects: fileURLToPath(new URL("./src/subjects.ts", import.meta.url)),
    server: fileURLToPath(new URL("./src/server.ts", import.meta.url)),
  },
  sourcemap: true,
});
