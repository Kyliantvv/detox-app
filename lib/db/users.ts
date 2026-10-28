import type { User } from "@prisma/client";
import { levelFor } from "../game";

// Données privées : jamais dans le JSON public, puisque Clairvoyance vend
// le solde, la série et la dernière connexion. Le JSON public garde le niveau
// et « En ligne », affichés sur le profil d'un ami avant tout achat.

/** « En ligne » : une activité il y a moins de 2 minutes. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export { levelFor };

/** Utilisateur tel que le renvoie `db` : sans `passwordHash`, sauf `omit: { passwordHash: false }`. */
export type UserRow = Omit<User, "passwordHash"> & { passwordHash?: string };

export function isOnline(lastActiveAt: Date | null | undefined, now = Date.now()) {
  return !!lastActiveAt && now - lastActiveAt.getTime() < ONLINE_WINDOW_MS;
}

/** JSON public d'un utilisateur : profil, niveau et « En ligne ». */
export function toPublicUser(user: UserRow) {
  const { id, username, displayName, bio, avatarPath, avatarColor, createdAt, updatedAt } = user;
  return {
    id, username, displayName, bio, avatarPath, avatarColor, createdAt, updatedAt,
    level: levelFor(user.totalEarned),
    online: isOnline(user.lastActiveAt),
  };
}

/** JSON du compte connecté (`/me`) : le public plus les champs privés, sans `passwordHash`. */
export function toSelfJSON(user: UserRow) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...self } = user;
  return { ...self, level: levelFor(user.totalEarned), online: isOnline(user.lastActiveAt) };
}
