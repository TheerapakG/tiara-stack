import path from "pathe";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: path.resolve(__dirname, "src/index.ts"),
    runServer: path.resolve(__dirname, "src/runServer.ts"),
  },
});
