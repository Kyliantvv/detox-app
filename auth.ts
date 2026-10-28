// Authentification de l'app (NextAuth v5, sessions JWT dans un cookie httpOnly chiffré).
// La session porte aussi le JWT de l'API (accessToken), envoyé en Bearer par le front.
import NextAuth, { CredentialsSignin, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginDemo, loginWithPassword } from "@/lib/server/accounts";
import { signToken, verifyToken } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";

declare module "next-auth" {
  interface User {
    username: string;
    accessToken: string;
  }
  interface Session {
    accessToken: string;
    user: { id: string; email: string; username: string };
  }
}

const SESSION_MAX_AGE_S = 7 * 24 * 3600;

// Le type JWT de @auth/core n'est pas augmentable ici (non hoisté par pnpm) : champs lus avec garde.
const text = (value: unknown) => (typeof value === "string" ? value : "");

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}

function toUser(result: ReturnType<typeof loginDemo>): User {
  return { ...result.user, accessToken: result.token };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "detox-dev-auth-secret"),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize(credentials) {
        const { email, password } = credentials;
        if (typeof email !== "string" || typeof password !== "string") throw new InvalidLogin();
        try {
          return toUser(loginWithPassword(email, password));
        } catch (error) {
          if (error instanceof ApiError) throw new InvalidLogin();
          throw error;
        }
      },
    }),
    Credentials({ id: "demo", name: "Compte démo", credentials: {}, authorize: () => toUser(loginDemo()) }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.username = user.username;
        token.accessToken = user.accessToken;
      }
      // La session glisse : on ré-émet le JWT de l'API s'il a expiré entre-temps.
      const accessToken = text(token.accessToken);
      if (token.sub && !(accessToken && verifyToken(accessToken)) && db().users.has(token.sub)) {
        token.accessToken = signToken(token.sub);
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.username = text(token.username);
      session.accessToken = text(token.accessToken);
      return session;
    },
  },
});
