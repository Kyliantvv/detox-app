import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Alias `@/*` de tsconfig.json.
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // Remet en place les vi.spyOn (Math.random…) et les variables d'environnement après chaque test.
    restoreMocks: true,
    unstubEnvs: true,
    exclude: ["**/node_modules/**", "**/.next/**"],
    // next-auth importe `next/server` sans extension, ce que Node refuse en ESM :
    // Vite le transforme et résout l'import à sa place.
    server: { deps: { inline: ["next-auth"] } },
  },
});
