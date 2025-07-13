import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { globSync } from "glob";
import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "rollup";
// @ts-expect-error wrong typing
import dts from "unplugin-dts/rollup";
import { fileURLToPath } from "url";

const filePaths = globSync("./src/**/*.ts", { nodir: true }).map((file) =>
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
  treeshake: {
    moduleSideEffects: "no-external",
  },
  external: [...builtinModules, /^node:/],
  plugins: [
    nodeResolve(),
    typescript(),
    {
      name: "disable-treeshake",
      transform(code, id) {
        if (filePaths.includes(id)) {
          return {
            code,
            moduleSideEffects: "no-treeshake",
          };
        }
        return { code };
      },
    },
    terser({
      toplevel: false,
      keep_fnames: true,
      compress: {
        unused: false,
      },
    }),
    getBabelOutputPlugin({
      configFile: fileURLToPath(
        new URL("./babel.config.json", import.meta.url),
      ),
    }),
    dts({
      include: ["./src/**/*.ts"],
    }),
  ],
});
