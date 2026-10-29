// Appelle un handler de route directement, sans serveur HTTP : on construit le NextRequest
// et le contexte `{ params }` que Next lui passerait.
import { NextRequest } from "next/server";
import { expect, vi } from "vitest";
import { signToken } from "@/lib/server/auth";
import { USERS } from "@/scripts/scenario";

export type Handler<Ctx> = (request: NextRequest, ctx: Ctx) => Response | Promise<Response>;

export type CallOptions = {
  // Par défaut : POST s'il y a un corps, GET sinon.
  method?: string;
  // Utilisateur connecté, compte de la maquette (« alex », « lina »…) ou id brut :
  // envoie un Bearer valide pour lui.
  as?: string;
  // Bearer brut, pour tester les tokens invalides.
  token?: string;
  // Objet sérialisé en JSON ; FormData et chaînes envoyés tels quels.
  body?: unknown;
  query?: Record<string, string>;
  // Segments dynamiques, résolus comme `ctx.params`.
  params?: Record<string, string>;
  headers?: Record<string, string>;
};

// Les tests vérifient eux-mêmes la forme des réponses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export function apiRequest({ method, as, token, body, query, headers }: CallOptions = {}): NextRequest {
  const url = new URL("http://localhost/");
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const init = { method: method ?? (body === undefined ? "GET" : "POST"), headers: new Headers(headers) };
  const bearer = token ?? (as ? signToken(USERS[as as keyof typeof USERS] ?? as) : undefined);
  if (bearer) init.headers.set("authorization", `Bearer ${bearer}`);
  if (body === undefined) return new NextRequest(url, init);
  if (body instanceof FormData || typeof body === "string") return new NextRequest(url, { ...init, body });
  init.headers.set("content-type", "application/json");
  return new NextRequest(url, { ...init, body: JSON.stringify(body) });
}

export async function call<Ctx>(handler: Handler<Ctx>, options: CallOptions = {}) {
  const ctx = { params: Promise.resolve(options.params ?? {}) } as Ctx;
  const response = await handler(apiRequest(options), ctx);
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body: Json = isJson ? await response.clone().json() : undefined;
  return { status: response.status, body, response };
}

// Forme normalisée des erreurs de l'API (voir lib/server/http.ts).
export const apiError = (code: string, message: unknown = expect.any(String)) => ({ error: { code, message } });

// Horloge figée : seule Date est simulée, les flux de Request/Response gardent les vrais timers.
export const freezeTime = () => vi.useFakeTimers({ toFake: ["Date"] });
export const advanceTime = (ms: number) => vi.setSystemTime(Date.now() + ms);
