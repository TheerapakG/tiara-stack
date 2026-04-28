import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { defineConfig } from "vite-plus";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

const collectEntries = (relativeDir: string): Record<string, string> =>
  Object.fromEntries(
    readdirSync(fileURLToPath(new URL(`./src/${relativeDir}`, import.meta.url)), {
      recursive: true,
      withFileTypes: true,
    })
      .filter(
        (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"),
      )
      .map((entry) => {
        const path = `${entry.parentPath}/${entry.name}`;
        const relativePath = path
          .slice(srcDir.length + 1)
          .replace(/\.ts$/, "")
          .replace(/\/index$/, "");

        return [relativePath, path];
      }),
  );

export default defineConfig({
  pack: {
    entry: {
      "api-groups": fileURLToPath(new URL("./src/api-groups.ts", import.meta.url)),
      api: fileURLToPath(new URL("./src/api.ts", import.meta.url)),
      "handlers/health/schema": fileURLToPath(
        new URL("./src/handlers/health/schema.ts", import.meta.url),
      ),
      index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      "middlewares/sheetAuthTokenAuthorization/tag": fileURLToPath(
        new URL("./src/middlewares/sheetAuthTokenAuthorization/tag.ts", import.meta.url),
      ),
      "middlewares/sheetApisRpcAuthorization/tag": fileURLToPath(
        new URL("./src/middlewares/sheetApisRpcAuthorization/tag.ts", import.meta.url),
      ),
      "sheet-apis": fileURLToPath(new URL("./src/sheet-apis.ts", import.meta.url)),
      "sheet-apis-rpc": fileURLToPath(new URL("./src/sheet-apis-rpc.ts", import.meta.url)),
      "sheet-bot": fileURLToPath(new URL("./src/sheet-bot.ts", import.meta.url)),
      ...collectEntries("schemas"),
    },
    sourcemap: true,
    deps: {
      onlyBundle: false,
    },
  },
  lint: {
    ignorePatterns: ["dist"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
