// Création de compte et connexion, partagées par les routes /api/auth/* et NextAuth (auth.ts).
import { EMAIL, PASSWORD_MIN, USERNAME } from "../validation";
import { signToken } from "./auth";
import { DEFAULT_FOLLOWING, DEMO_ID, db, followingOf, uid, userByEmail, userByUsername, type DbUser } from "./db";
import { ApiError } from "./http";
import { hashPassword, verifyPassword } from "./password";
import { startSession, withPoints } from "./points";
import { authUser } from "./views";

// Ce que reçoit le client après connexion : identité publique, JWT de l'API et gains de connexion.
function session(user: DbUser, firstTime: boolean) {
  const gains = startSession(user.id, firstTime);
  return { user: authUser(user), token: signToken(user.id), ...withPoints(user.id, gains) };
}

export function registerAccount(input: { email: string; username: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  if (!EMAIL.test(email)) throw new ApiError("INVALID_INPUT", "Adresse e-mail invalide.");
  if (!USERNAME.test(username)) {
    throw new ApiError("INVALID_INPUT", "Nom d'utilisateur : 3 à 30 caractères, lettres, chiffres, points ou _.");
  }
  if (input.password.length < PASSWORD_MIN) {
    throw new ApiError("INVALID_INPUT", `Mot de passe : ${PASSWORD_MIN} caractères minimum.`);
  }
  if (userByEmail(email)) throw new ApiError("EMAIL_ALREADY_USED", "Cet e-mail est déjà utilisé.");
  if (userByUsername(username)) throw new ApiError("USERNAME_ALREADY_USED", "Ce nom d'utilisateur est déjà pris.");

  const user: DbUser = {
    id: uid(),
    email,
    username,
    name: username,
    bio: "",
    passwordHash: hashPassword(input.password),
    status: "En ligne",
    shielded: false,
    bot: false,
    createdAt: Date.now(),
  };
  db().users.set(user.id, user);
  DEFAULT_FOLLOWING.forEach((id) => followingOf(user.id).add(id));
  return session(user, true);
}

export function loginWithPassword(email: string, password: string) {
  const user = userByEmail(email.trim());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError("UNAUTHORIZED", "E-mail ou mot de passe incorrect.");
  }
  return session(user, false);
}

// Bouton « Compte démo » : connexion sans mot de passe au compte seedé.
export function loginDemo() {
  return session(db().users.get(DEMO_ID)!, false);
}
