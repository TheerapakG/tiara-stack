import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { builtinModules } from "module";
import { defineConfig } from "rollup";
// @ts-expect-error wrong typing
import dts from "unplugin-dts/rollup";
import { fileURLToPath } from "url";

const indexPath = fileURLToPath(new URL("src/index.ts", import.meta.url));

export default defineConfig({
  input: {
    index: indexPath,
  },
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
    commonjs(),
    typescript(),
    {
      name: "disable-treeshake",
      transform(code, id) {
        if (id === indexPath) {
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
      presets: [["@babel/preset-env"]],
      plugins: [
        ["@babel/plugin-transform-class-properties"],
        ["@babel/plugin-transform-logical-assignment-operators"],
        ["@babel/plugin-transform-numeric-separator"],
        ["@babel/plugin-transform-destructuring"],
        ["@babel/plugin-transform-for-of"],
        [
          "@babel/plugin-transform-regenerator",
          {
            asyncGenerators: true,
            generators: true,
            async: false,
          },
        ],
      ],
      targets: "node 22",
    }),
    dts({
      include: ["./src/**/*.ts"],
    }),
  ],
});
