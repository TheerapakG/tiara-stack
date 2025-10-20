import path from "pathe";
import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: path.resolve(__dirname, "src/index.ts"),
    },
  },
  {
    entry: {
      runServer: path.resolve(__dirname, "src/runServer.ts"),
    },
    external: ["playwright", "playwright-core"],
    noExternal: [/^.*$/],
  },
]);
