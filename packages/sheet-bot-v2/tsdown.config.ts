import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    main: "src/main.ts",
  },
  sourcemap: true,
  noExternal: [/^.*$/],
});
