import { lightFormat } from "date-fns";
import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import simpleGit from "simple-git";

const git = simpleGit();
const date = lightFormat(new Date(), "yyyyMMdd");
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
