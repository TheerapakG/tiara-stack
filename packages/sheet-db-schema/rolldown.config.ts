import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig({
  input: {
    index: path.resolve(__dirname, "src/schema.ts"),
  },
  output: [
    {
      dir: "dist",
      format: "es",
    },
  ],
  platform: "node",
  plugins: [dts()],
  external: [...builtinModules, /^node:/],
});
