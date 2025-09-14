import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { aliasPlugin } from "rolldown/experimental";
import { PluginPure } from "rollup-plugin-pure";

export default defineConfig({
  input: {
    index: path.resolve(__dirname, "src/index.ts"),
    runServer: path.resolve(__dirname, "src/runServer.ts"),
  },
  output: {
    dir: "dist",
    format: "es",
  },
  platform: "node",
  plugins: [
    dts(),
    aliasPlugin({
      entries: [
        { find: "~~", replacement: path.resolve(__dirname, ".") },
        { find: "@@", replacement: path.resolve(__dirname, ".") },
        { find: "~", replacement: path.resolve(__dirname, "src") },
        { find: "@", replacement: path.resolve(__dirname, "src") },
      ],
    }),
    PluginPure({
      functions: [/^.*$/],
    }),
  ],
  treeshake: true,
  external: [...builtinModules, /^node:/],
});
