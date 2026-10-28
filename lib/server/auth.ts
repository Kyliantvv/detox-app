// JWT HS256 signés avec JWT_SECRET, sans dépendance externe.
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, touch, type DbUser } from "./db";
import { ApiError } from "./http";

const TOKEN_TTL_S = 7 * 24 * 3600;

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET manquant.");
  return "detox-dev-secret";
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function signToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_S }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token: string): string | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = Buffer.from(sign(`${header}.${payload}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof sub === "string" && exp * 1000 > Date.now() ? sub : null;
  } catch {
    return null;
  }
}

// Middleware Bearer : renvoie l'utilisateur du token ou lève UNAUTHORIZED.
export function requireUser(request: Request): DbUser {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = token ? verifyToken(token) : null;
  const user = userId ? db().users.get(userId) : undefined;
  if (!user) throw new ApiError("UNAUTHORIZED", "Token manquant ou invalide.");
  touch(user.id);
  return user;
}
