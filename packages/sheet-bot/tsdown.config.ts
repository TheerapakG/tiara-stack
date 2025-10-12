import { lightFormat } from "date-fns";
import path from "pathe";
import simpleGit from "simple-git";
import { defineConfig } from "tsdown";

const git = simpleGit();
const date = lightFormat(new Date(), "yyyyMMdd");
const hash = (await git.revparse("HEAD")).substring(0, 7);

export default defineConfig({
  entry: {
    index: path.resolve(__dirname, "src/index.ts"),
    register: path.resolve(__dirname, "src/register.ts"),
  },
  env: {
    BUILD_DATE: date,
    BUILD_HASH: hash,
    BUILD_VERSION: `${date}-${hash}`,
  },
  noExternal: [/^.*$/],
});
