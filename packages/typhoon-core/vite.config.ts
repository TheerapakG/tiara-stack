import { globSync } from "glob";
import { builtinModules } from "module";
import path from "pathe";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const filePaths = globSync("./src/**/index.ts", { nodir: true }).map((file) =>
  fileURLToPath(new URL(file, import.meta.url)),
);

export default defineConfig({
  build: {
    target: "node20",
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        ...Object.fromEntries(
          filePaths.map((filePath) => {
            const relativePath = path.relative("./src", filePath);
            const parsed = path.parse(relativePath);
            const module = path.join(
              parsed.dir.replace(/\.+\//g, ""),
              parsed.name,
            );

            return [module, filePath];
          }),
        ),
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: [...builtinModules, /^node:/, "effect"],
    },
  },
});
