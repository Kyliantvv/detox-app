// Réponses et erreurs normalisées de l'API (voir « Contrat d'API » dans le README).
import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { connectDb } from "../db/connect";
import { toApiError } from "../db/errors";

const STATUS = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  EMAIL_ALREADY_USED: 409,
  USERNAME_ALREADY_USED: 409,
  INSUFFICIENT_POINTS: 409,
  CONFLICT: 409,
  TARGET_SHIELDED: 409,
} as const;

export type ErrorCode = keyof typeof STATUS;

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export const errorResponse = (code: ErrorCode, message: string) =>
  json({ error: { code, message } }, STATUS[code]);

// Enveloppe un handler : toute ApiError levée devient une réponse d'erreur normalisée,
// comme les erreurs de lib/db (id mal formé, introuvable, doublon) via toApiError.
// La première requête connecte la base : en production, connectDb() refuse de démarrer s'il manque un index.
export function route<Ctx>(handler: (request: NextRequest, ctx: Ctx) => Response | Promise<Response>) {
  return async (request: NextRequest, ctx: Ctx) => {
    try {
      // Sans MONGODB_URI (tests unitaires), seul un handler qui lit la base échoue.
      if (process.env.MONGODB_URI) await connectDb();
      return await handler(request, ctx);
    } catch (error) {
      // Les erreurs internes de Next (interruption du prérendu au build) doivent remonter telles quelles.
      unstable_rethrow(error);
      if (error instanceof ApiError) return errorResponse(error.code, error.message);
      const dbError = toApiError(error);
      if (dbError) return json(dbError.body, dbError.status);
      console.error(error);
      return json({ error: { code: "INTERNAL", message: "Erreur interne." } }, 500);
    }
  };
}

const ID = /^[a-zA-Z0-9._-]{1,64}$/;

export function assertId(id: string, label = "id"): string {
  if (!ID.test(id)) throw new ApiError("INVALID_INPUT", `${label} mal formé.`);
  return id;
}

type FieldType = "string" | "string?" | "number" | "number?";
type Body<S extends Record<string, FieldType>> = {
  [K in keyof S]: S[K] extends "string"
    ? string
    : S[K] extends "string?"
      ? string | undefined
      : S[K] extends "number"
        ? number
        : number | undefined;
};

// Lit un corps JSON, vérifie les types et refuse les champs inconnus.
export async function readBody<S extends Record<string, FieldType>>(request: Request, spec: S): Promise<Body<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("INVALID_INPUT", "Corps JSON invalide.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("INVALID_INPUT", "Le corps doit être un objet JSON.");
  }
  const record = body as Record<string, unknown>;
  const unknown = Object.keys(record).filter((key) => !(key in spec));
  if (unknown.length) throw new ApiError("INVALID_INPUT", `Champ(s) inconnu(s) : ${unknown.join(", ")}.`);
  for (const [key, type] of Object.entries(spec)) {
    const value = record[key];
    const optional = type.endsWith("?");
    if (value === undefined && optional) continue;
    if (typeof value !== type.replace("?", "")) {
      throw new ApiError("INVALID_INPUT", `Champ « ${key} » : ${type.replace("?", "")} attendu.`);
    }
  }
  return record as Body<S>;
}
