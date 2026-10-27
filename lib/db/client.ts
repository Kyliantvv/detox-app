import { PrismaClient } from "@prisma/client";
import { validation } from "./validation";

// `passwordHash` est omis de toutes les lectures. Pour le lire (connexion) :
// `db.user.findUnique({ where, omit: { passwordHash: false } })`.
function createClient() {
  return new PrismaClient({ omit: { user: { passwordHash: true } } }).$extends(validation);
}

export type Db = ReturnType<typeof createClient>;
/** Client d'une transaction interactive (`db.$transaction(async (tx) => …)`). */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

// Survit au hot reload de `next dev`, qui réévalue les modules. Le client ne
// se connecte qu'à la première requête : l'importer ne demande pas MONGODB_URI.
const cache = globalThis as unknown as { db?: Db };

export const db = (cache.db ??= createClient());
