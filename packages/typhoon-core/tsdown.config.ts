import { globSync } from "glob";
import path from "pathe";
import { defineConfig } from "tsdown";
import { fileURLToPath } from "url";

const filePaths = [
  ...globSync("./src/index.ts", { nodir: true }).map((file) =>
    fileURLToPath(new URL(file, import.meta.url)),
  ),
  ...globSync("./src/*/index.ts", { nodir: true }).map((file) =>
    fileURLToPath(new URL(file, import.meta.url)),
  ),
];

export default defineConfig({
  entry: Object.fromEntries(
    filePaths.map((filePath) => {
      const relativePath = path.relative("./src", filePath);
      const parsed = path.parse(relativePath);
      const module = path.join(parsed.dir.replace(/\.+\//g, ""), parsed.name);

      return [module, filePath];
    }),
  ),
  dts: {
    tsgo: true,
  },
});
