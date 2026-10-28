// Création de compte et connexion, partagées par les routes /api/auth/* et NextAuth (auth.ts).
import { db, isDuplicateKey, type UserRow as User } from "../db";
import { EMAIL, PASSWORD_MIN, USERNAME } from "../validation";
import { signToken } from "./auth";
import { DEFAULT_FOLLOWING } from "./content";
import { ApiError } from "./http";
import { hashPassword, verifyPassword } from "./password";
import { startSession, withPoints } from "./points";
import { authUser } from "./views";

// Ce que reçoit le client après connexion : identité publique, JWT de l'API et gains de connexion.
async function session(user: User, firstTime: boolean) {
  const gains = await startSession(user.id, firstTime);
  return { user: authUser(user), token: signToken(user.id), ...(await withPoints(user.id, gains)) };
}

export async function registerAccount(input: { email: string; username: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ApiError("INVALID_INPUT", "Adresse e-mail invalide.");
  if (!USERNAME.test(username)) {
    throw new ApiError("INVALID_INPUT", "Nom d'utilisateur : 3 à 30 caractères, lettres, chiffres, points ou _.");
  }
  if (input.password.length < PASSWORD_MIN) {
    throw new ApiError("INVALID_INPUT", `Mot de passe : ${PASSWORD_MIN} caractères minimum.`);
  }
  const taken = async () => {
    if (await db.user.findUnique({ where: { email } })) {
      throw new ApiError("EMAIL_ALREADY_USED", "Cet e-mail est déjà utilisé.");
    }
    if (await db.user.findUnique({ where: { username } })) {
      throw new ApiError("USERNAME_ALREADY_USED", "Ce nom d'utilisateur est déjà pris.");
    }
  };
  await taken();

  let user: User;
  try {
    user = await db.user.create({ data: { email, username, passwordHash: hashPassword(input.password), lastActiveAt: new Date() } });
  } catch (error) {
    // Inscription simultanée avec le même e-mail ou pseudo : l'index unique tranche.
    if (isDuplicateKey(error)) await taken();
    throw error;
  }
  const defaults = await db.user.findMany({ where: { username: { in: DEFAULT_FOLLOWING } }, select: { id: true } });
  if (defaults.length) {
    await db.follow.createMany({ data: defaults.map(({ id }) => ({ followerId: user.id, followingId: id })) });
  }
  return session(user, true);
}

export async function loginWithPassword(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, omit: { passwordHash: false } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError("UNAUTHORIZED", "E-mail ou mot de passe incorrect.");
  }
  return session(user, false);
}
