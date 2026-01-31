import { defineConfig } from "tsdown";
import { fileURLToPath } from "url";
import { tiaraPlugin } from "typhoon-core/bundler";

export default defineConfig([
  {
    entry: {
      api: fileURLToPath(new URL("./src/api.ts", import.meta.url)),
    },
    env: {
      TIARA_STRIP_HANDLER: "true",
    },
    sourcemap: true,
    plugins: [tiaraPlugin()],
  },
  {
    entry: {
      index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
    sourcemap: true,
    external: ["playwright", "playwright-core"],
    noExternal: [/^.*$/],
  },
]);
