import { lightFormat } from "date-fns";
import { fileURLToPath } from "url";
import simpleGit from "simple-git";
import { defineConfig } from "tsdown";

const git = simpleGit();
const date = lightFormat(new Date(), "yyyyMMdd");
const hash = (await git.revparse("HEAD")).substring(0, 7);

export default defineConfig({
  entry: {
    index: fileURLToPath(new URL("src/index.ts", import.meta.url)),
    register: fileURLToPath(new URL("src/register.ts", import.meta.url)),
  },
  sourcemap: true,
  env: {
    BUILD_DATE: date,
    BUILD_HASH: hash,
    BUILD_VERSION: `${date}-${hash}`,
  },
  noExternal: [/^.*$/],
});
