import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, jsonOptions } from "../schema-options";

// Données privées : jamais dans le JSON public, puisque Clairvoyance vend
// le solde, la série et la dernière connexion. Le JSON public garde le niveau
// et « En ligne », affichés sur le profil d'un ami avant tout achat.
const PRIVATE_FIELDS = [
  "email", "role", "points", "totalEarned", "streak", "postsSeen", "postsSeenToday",
  "combo", "timeSpentSec", "lastActiveAt",
];

/** « En ligne » : une activité il y a moins de 2 minutes. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, trim: true, maxlength: 50 },
    bio: { type: String, maxlength: 150, default: "" },
    avatarPath: String,
    avatarColor: { type: String, enum: ["pink", "yellow", "green", "purple", "grey"], default: "green" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Solde dépensable. `min: 0` ne joue qu'au save() : `$inc` ne passe par
    // aucun validateur. Ne modifier que via lib/db/points.ts.
    points: { type: Number, default: 0, min: 0 },
    // Cumul des gains, ne baisse jamais : sert au niveau.
    totalEarned: { type: Number, default: 0, min: 0 },
    streak: {
      current: { type: Number, default: 0 },
      best: { type: Number, default: 0 },
      lastLoginDay: String, // YYYY-MM-DD, heure de Paris
    },
    // Posts vus dans le Flow, au total (coffre) et aujourd'hui. Ne modifier que
    // via lib/db/activity.ts.
    postsSeen: { type: Number, default: 0 },
    postsSeenToday: { day: String, count: { type: Number, default: 0 } },
    // Actions enchaînées sans pause, pour le multiplicateur de combo.
    combo: { count: { type: Number, default: 0 }, lastActionAt: Date },
    // Temps passé dans l'app, pour le Bilan.
    timeSpentSec: { type: Number, default: 0 },
    lastActiveAt: Date,
  },
  {
    ...baseOptions,
    toJSON: jsonOptions((ret) => {
      ret.level = levelFor(Number(ret.totalEarned ?? 0));
      ret.online = isOnline(ret.lastActiveAt as Date | undefined);
      for (const f of PRIVATE_FIELDS) delete ret[f];
    }),
  },
);

export function levelFor(totalEarned: number) {
  return Math.floor(Math.sqrt(totalEarned / 30));
}

export function isOnline(lastActiveAt: Date | null | undefined, now = Date.now()) {
  return !!lastActiveAt && now - lastActiveAt.getTime() < ONLINE_WINDOW_MS;
}

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = defineModel("User", userSchema);

/** JSON du compte connecté (`/me`) : le public plus les champs privés, sans `passwordHash`. */
export function toSelfJSON(user: InstanceType<typeof User>) {
  const self: Record<string, unknown> = user.toObject({ virtuals: true, versionKey: false });
  delete self._id;
  delete self.passwordHash;
  self.level = levelFor(user.totalEarned);
  self.online = isOnline(user.lastActiveAt);
  return self;
}

