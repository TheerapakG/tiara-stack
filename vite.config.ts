import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["packages/sheet-web/src/routeTree.gen.ts", "dist", ".output", "node_modules"],
  },
  lint: {
    ignorePatterns: [".output", "dist", "node_modules"],
    options: { typeAware: true, typeCheck: true },
  },
});
