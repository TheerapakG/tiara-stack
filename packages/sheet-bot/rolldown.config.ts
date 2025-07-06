import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import simpleGit from "simple-git";

const git = simpleGit();
const date = `${new Date().getUTCFullYear().toString().padStart(4, "0")}${new Date().getUTCMonth().toString().padStart(2, "0")}${new Date().getUTCDate().toString().padStart(2, "0")}`;
const hash = (await git.revparse("HEAD")).substring(0, 7);

export default defineConfig({
  input: {
    index: path.resolve(__dirname, "src/index.ts"),
  },
  output: [
    {
      dir: "dist",
      format: "es",
    },
  ],
  define: {
    "process.env.BUILD_DATE": `"${date}"`,
    "process.env.BUILD_HASH": `"${hash}"`,
    "process.env.BUILD_VERSION": `"${date}-${hash}"`,
  },
  platform: "node",
  plugins: [dts()],
  external: [...builtinModules, /^node:/],
});
