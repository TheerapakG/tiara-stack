import { globSync } from "glob";
import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { fileURLToPath } from "url";

const filePaths = globSync("./src/**/index.ts", { nodir: true }).map((file) =>
  fileURLToPath(new URL(file, import.meta.url)),
);

export default defineConfig({
  input: Object.fromEntries(
    filePaths.map((filePath) => {
      const relativePath = path.relative("./src", filePath);
      const parsed = path.parse(relativePath);
      const module = path.join(parsed.dir.replace(/\.+\//g, ""), parsed.name);

      return [module, filePath];
    }),
  ),
  output: [
    {
      dir: "dist",
      format: "es",
    },
  ],
  plugins: [dts()],
  external: [...builtinModules, /^node:/, "effect", "arktype"],
});
