import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests sans base de données.
const UNIT_TESTS = ["lib/**/*.test.ts", "scripts/**/*.test.ts", "proxy.test.ts", "app/api/{openapi,files}/*.test.ts"];
// Tests qui lisent ou écrivent la base : routes, couche serveur et lib/db. Ils tournent sur une vraie
// MongoDB en replica set (TEST_MONGODB_URI, base *_test), et sont sautés sans elle.
const DB_TESTS = ["app/api/**/*.test.ts", "lib/db/**/*.test.ts", "lib/server/{points,recommend,require-user}.test.ts"];
const withDb = Boolean(process.env.TEST_MONGODB_URI);

export default defineConfig({
  resolve: {
    // Alias `@/*` de tsconfig.json.
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Remet en place les vi.spyOn (Math.random…) et les variables d'environnement après chaque test.
    restoreMocks: true,
    unstubEnvs: true,
    // next-auth importe `next/server` sans extension, ce que Node refuse en ESM :
    // Vite le transforme et résout l'import à sa place.
    server: { deps: { inline: ["next-auth"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: UNIT_TESTS,
          exclude: [...DB_TESTS.filter((glob) => !glob.startsWith("app/")), "**/node_modules/**"],
          setupFiles: ["./test/setup.ts"],
        },
      },
      ...(withDb
        ? [
            {
              extends: true,
              test: {
                name: "db",
                include: DB_TESTS,
                exclude: ["app/api/{openapi,files}/*.test.ts", "**/node_modules/**"],
                globalSetup: ["./test/db-global.ts"],
                setupFiles: ["./test/setup.ts", "./test/db-setup.ts"],
                // Une seule base partagée, remise à zéro avant chaque test : un fichier à la fois.
                fileParallelism: false,
                testTimeout: 20_000,
                hookTimeout: 60_000,
              },
            },
          ]
        : []),
    ],
  },
});
