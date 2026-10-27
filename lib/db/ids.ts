import { Prisma } from "@prisma/client";
import { db, type Tx } from "./client";
import { InvalidInputError } from "./errors";

/** Id accepté par les helpers de lib/db : un ObjectId en texte (paramètre de route). */
export type Id = string;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Contrat d'API : un id mal formé donne 400, pas une erreur Prisma en 500. */
export function toId(id: Id, what = "id") {
  if (typeof id !== "string" || !OBJECT_ID.test(id)) throw new InvalidInputError(`${what} invalide`);
  return id;
}

const MAX_ATTEMPTS = 3;

/**
 * Exécute `fn` dans la transaction de l'appelant, ou dans une nouvelle si `tx`
 * est absent. Une nouvelle transaction est rejouée en cas de conflit d'écriture
 * (P2034), comme le faisait Mongoose.
 */
export async function inTransaction<T>(tx: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (tx) return fn(tx);
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(fn);
    } catch (err) {
      const conflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!conflict || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}
