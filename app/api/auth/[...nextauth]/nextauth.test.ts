// Couche NextAuth (auth.ts) : providers, callbacks jwt/session et JWT de l'API porté par la session.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { verifyToken } from "@/lib/server/auth";
import { advanceTime, call, freezeTime } from "@/test/api";
import { USERS } from "@/test/db";
import * as me from "../../me/route";
import { GET, POST } from "./route";

const BASE = "http://localhost/api/auth";
const ALEX = { email: "alex@detox.test", password: "demo1234" };

// Garde les cookies posés par NextAuth d'une requête à l'autre, comme un navigateur.
function browser() {
  const cookies = new Map<string, string>();
  const send = async (handler: typeof GET, path: string, init: { method?: string; headers?: HeadersInit; body?: BodyInit } = {}) => {
    const headers = new Headers(init.headers);
    headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await handler(new NextRequest(`${BASE}${path}`, { ...init, headers }));
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  };

  return {
    cookies,
    async signIn(provider: "credentials", fields: Record<string, string> = {}) {
      const { csrfToken } = (await (await send(GET, "/csrf")).json()) as { csrfToken: string };
      return send(POST, `/callback/${provider}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...fields, csrfToken }),
      });
    },
    async session() {
      return (await send(GET, "/session")).json() as Promise<{ accessToken: string; user: Record<string, string> } | null>;
    },
  };
}

describe("NextAuth", () => {
  it("expose le provider credentials", async () => {
    const response = await GET(new NextRequest(`${BASE}/providers`));

    expect(Object.keys((await response.json()) as object)).toEqual(["credentials"]);
  });

  it("ouvre une session avec e-mail et mot de passe", async () => {
    const client = browser();

    const response = await client.signIn("credentials", { email: "lina@detox.test", password: "demo1234" });

    expect(response.status).toBe(302);
    expect(client.cookies.has("authjs.session-token")).toBe(true);
    const session = await client.session();
    expect(session?.user).toMatchObject({ id: USERS.lina, email: "lina@detox.test", username: "lina.m" });
    expect(verifyToken(session!.accessToken)).toBe(USERS.lina);
  });

  it("fournit un accessToken accepté en Bearer par l'API", async () => {
    const client = browser();
    await client.signIn("credentials", ALEX);

    const session = await client.session();
    const res = await call(me.GET, { token: session!.accessToken });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(USERS.alex);
  });

  it("refuse un mauvais mot de passe sans ouvrir de session", async () => {
    const client = browser();

    const response = await client.signIn("credentials", { email: "lina@detox.test", password: "nope" });

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/connexion");
    expect(location.searchParams.get("code")).toBe("invalid_credentials");
    expect(client.cookies.has("authjs.session-token")).toBe(false);
    expect(await client.session()).toBeNull();
  });

  it("ré-émet le JWT de l'API quand il a expiré mais que la session glisse encore", async () => {
    freezeTime();
    const client = browser();
    await client.signIn("credentials", ALEX);
    const first = (await client.session())!.accessToken;

    // La session est prolongée à chaque lecture ; le JWT de l'API, lui, expire après 7 jours.
    advanceTime(6 * 86_400_000);
    expect((await client.session())!.accessToken).toBe(first);
    advanceTime(2 * 86_400_000);
    const renewed = (await client.session())!.accessToken;

    expect(verifyToken(first)).toBeNull();
    expect(renewed).not.toBe(first);
    expect(verifyToken(renewed)).toBe(USERS.alex);
  });
});
