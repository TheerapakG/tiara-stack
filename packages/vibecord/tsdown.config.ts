import { fileURLToPath } from "url";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: fileURLToPath(new URL("src/bot/index.ts", import.meta.url)),
    register: fileURLToPath(new URL("src/register.ts", import.meta.url)),
  },
  sourcemap: true,
  noExternal: [/^.*$/],
});
