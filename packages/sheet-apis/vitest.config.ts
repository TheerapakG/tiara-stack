import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "sheet-ingress-api/middlewares/forwardedAuthHeaders": fileURLToPath(
        new URL("../sheet-ingress-api/src/middlewares/forwardedAuthHeaders.ts", import.meta.url),
      ),
      "sheet-ingress-api": fileURLToPath(new URL("../sheet-ingress-api/src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
