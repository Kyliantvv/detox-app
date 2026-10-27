import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, jsonOptions } from "../schema-options";

// Données privées : jamais dans le JSON public, puisque Clairvoyance vend
// le solde, la série et la dernière connexion.
const PRIVATE_FIELDS = ["email", "points", "totalEarned", "streak", "postsSeen", "lastActiveAt"];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, trim: true, maxlength: 50 },
    bio: { type: String, maxlength: 150, default: "" },
    avatarPath: String,
    avatarColor: { type: String, enum: ["pink", "yellow", "green", "purple", "grey"], default: "green" },
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
    // Posts vus dans le Flow : barre « Encore N posts avant ton coffre ».
    postsSeen: { type: Number, default: 0 },
    lastActiveAt: Date,
  },
  {
    ...baseOptions,
    toJSON: jsonOptions((ret) => {
      for (const f of PRIVATE_FIELDS) delete ret[f];
    }),
  },
);

export function levelFor(totalEarned: number) {
  return Math.floor(Math.sqrt(totalEarned / 30));
}

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = defineModel("User", userSchema);

/** JSON du compte connecté (`/me`) : le public plus les champs privés, sans `passwordHash`. */
export function toSelfJSON(user: InstanceType<typeof User>) {
  const self: Record<string, unknown> = user.toObject({ virtuals: true, versionKey: false });
  delete self._id;
  delete self.passwordHash;
  return self;
}

