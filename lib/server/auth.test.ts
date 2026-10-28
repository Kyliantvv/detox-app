import { describe, expect, it, vi } from "vitest";
import { advanceTime, freezeTime } from "@/test/api";
import { accountOf } from "./db";
import { requireUser, signToken, verifyToken } from "./auth";
import { ApiError } from "./http";

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
const bearer = (token: string) => new Request("http://localhost/", { headers: { authorization: `Bearer ${token}` } });

describe("signToken / verifyToken", () => {
  it("signe un JWT HS256 valable 7 jours", () => {
    freezeTime();
    const now = Math.floor(Date.now() / 1000);
    const [header, payload] = signToken("alex").split(".");

    expect(decode(header)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decode(payload)).toEqual({ sub: "alex", iat: now, exp: now + 7 * 24 * 3600 });
  });

  it("retrouve l'utilisateur du token", () => {
    expect(verifyToken(signToken("lina"))).toBe("lina");
  });

  it("refuse un token expiré", () => {
    freezeTime();
    const token = signToken("alex");

    advanceTime(7 * 24 * 3_600_000 + 1000);

    expect(verifyToken(token)).toBeNull();
  });

  it("refuse un payload modifié", () => {
    const [header, , signature] = signToken("alex").split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "lina", exp: 9_999_999_999 })).toString("base64url");

    expect(verifyToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it("refuse un token signé avec un autre secret", () => {
    vi.stubEnv("JWT_SECRET", "autre-secret");
    const token = signToken("alex");
    vi.unstubAllEnvs();

    expect(verifyToken(token)).toBeNull();
  });

  it.each(["", "a.b", "a.b.c", "...", "a.b.c.d"])("refuse le token mal formé %j", (token) => {
    expect(verifyToken(token)).toBeNull();
  });

  it("exige JWT_SECRET en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");

    expect(() => signToken("alex")).toThrow("JWT_SECRET manquant.");
  });
});

describe("requireUser", () => {
  it("renvoie l'utilisateur du Bearer et note son passage", () => {
    freezeTime();
    advanceTime(1000);

    const user = requireUser(bearer(signToken("lina")));

    expect(user.username).toBe("lina.m");
    expect(accountOf("lina").lastSeenAt).toBe(Date.now());
  });

  it.each([
    ["sans en-tête", new Request("http://localhost/")],
    ["avec un token invalide", bearer("x.y.z")],
    ["pour un compte supprimé", bearer(signToken("fantome"))],
  ])("lève UNAUTHORIZED %s", (_, request) => {
    expect(() => requireUser(request)).toThrow(new ApiError("UNAUTHORIZED", "Token manquant ou invalide."));
  });
});
