import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Resuelve el alias `@/*` → `./src/*` (declarado en tsconfig.json para Next.js) también para
 * vitest, que corre fuera del bundler de Next y no lee tsconfig "paths" por su cuenta. Sin esto,
 * cualquier import `@/...` que no esté mockeado con `vi.mock` falla con "Cannot find package".
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
