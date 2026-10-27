import mongoose from "mongoose";

// Erreurs métier de lib/db. `code` et `status` suivent le contrat d'API :
// la route renvoie `{ error: { code, message } }` avec ce statut (voir toApiError).
export class DbError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DbError {
  constructor(what: string) {
    super("NOT_FOUND", 404, `${what} introuvable`);
  }
}

export class InvalidInputError extends DbError {
  constructor(message: string) {
    super("INVALID_INPUT", 400, message);
  }
}

export class InsufficientPointsError extends DbError {
  constructor() {
    super("INSUFFICIENT_POINTS", 409, "Solde insuffisant");
  }
}

/** Violation d'un index unique (E11000) : doublon de like, de page de Flow, d'achat… */
export function isDuplicateKey(err: unknown) {
  return (err as { code?: unknown } | null)?.code === 11000;
}

/**
 * Traduit une erreur venue de lib/db en réponse du contrat d'API, ou null si
 * elle est inattendue (la route la laisse alors remonter en 500).
 */
export function toApiError(err: unknown): { status: number; body: { error: { code: string; message: string } } } | null {
  const reply = (status: number, code: string, message: string) => ({ status, body: { error: { code, message } } });
  if (err instanceof DbError) return reply(err.status, err.code, err.message);
  if (err instanceof mongoose.Error.CastError) return reply(400, "INVALID_INPUT", `Valeur invalide pour ${err.path}`);
  if (err instanceof mongoose.Error.ValidationError) return reply(400, "INVALID_INPUT", err.message);
  if (isDuplicateKey(err)) return reply(409, "CONFLICT", "Existe déjà");
  return null;
}
