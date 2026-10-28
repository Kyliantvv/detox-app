import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import type { Session } from "next-auth";
import { NextRequest, type NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import proxy, { config } from "./proxy";

// auth(handler) de NextAuth ajoute `request.auth` avant d'appeler le handler :
// on garde le handler tel quel et on fournit la session nous-mêmes.
vi.mock("@/auth", () => ({ auth: (handler: unknown) => handler }));

type Guard = (request: NextRequest & { auth: Session | null }) => NextResponse;

const SESSION: Session = {
  user: { id: "alex", email: "alex@detox.test", username: "alex.detox" },
  accessToken: "token",
  expires: "2099-01-01T00:00:00.000Z",
};

const visit = (path: string, session: Session | null) =>
  (proxy as unknown as Guard)(Object.assign(new NextRequest(`http://localhost${path}`), { auth: session }));

const redirectedTo = (response: NextResponse) => {
  const location = response.headers.get("location");
  return location && new URL(location).pathname;
};

describe("proxy", () => {
  it.each(["/", "/reels", "/u/lina.m", "/messages/karim"])("renvoie %s vers /connexion sans session", (path) => {
    const response = visit(path, null);

    expect(response.status).toBe(307);
    expect(redirectedTo(response)).toBe("/connexion");
  });

  it.each(["/connexion", "/inscription"])("laisse passer %s sans session", (path) => {
    const response = visit(path, null);

    expect(redirectedTo(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/connexion", "/inscription"])("renvoie %s vers l'accueil avec une session", (path) => {
    expect(redirectedTo(visit(path, SESSION))).toBe("/");
  });

  it("laisse passer les pages de l'app avec une session", () => {
    expect(redirectedTo(visit("/u/lina.m", SESSION))).toBeNull();
  });
});

describe("matcher du proxy", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it.each(["/", "/connexion", "/u/lina.m", "/u/karim.zen", "/epicerie/clairvoyance"])("s'applique à la page %s", (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each(["/api/me", "/api/auth/session", "/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/logo.png", "/robots.txt", "/manifest.webmanifest"])(
    "ignore %s",
    (url) => {
      expect(matches(url)).toBe(false);
    },
  );
});
