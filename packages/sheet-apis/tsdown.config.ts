import { fileURLToPath } from "url";
import { defineConfig } from "tsdown";
import { tiaraPlugin } from "typhoon-core/bundler";

export default defineConfig([
  {
    entry: {
      index: fileURLToPath(new URL("src/index.ts", import.meta.url)),
    },
    env: {
      TIARA_STRIP_HANDLER: "true",
    },
    sourcemap: true,
    plugins: [tiaraPlugin()],
  },
  {
    entry: {
      runServer: fileURLToPath(new URL("src/runServer.ts", import.meta.url)),
    },
    sourcemap: true,
    external: ["playwright", "playwright-core"],
    noExternal: [/^.*$/],
    plugins: [tiaraPlugin()],
  },
]);
