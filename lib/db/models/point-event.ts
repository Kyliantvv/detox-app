import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, parisDay, defineModel } from "../schema-options";

export const POINT_EVENT_TYPES = [
  "flow_page",
  "like",
  "comment",
  "repost",
  "daily_login",
  "bonus",
  "combo",
  "shop_purchase",
  "skill_purchase",
  "draw_cost",
  "draw_payout",
] as const;

// Journal de chaque mouvement de points, écrit par le serveur uniquement.
// Sert aussi à l'historique et à plusieurs compétences (temps de scroll,
// plus gros gain, heures de pointe).
const pointEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true }, // positif = gain, négatif = débit
    type: { type: String, enum: POINT_EVENT_TYPES, required: true },
    // Obligatoire pour flow_page : sinon l'index unique partiel stocke null et
    // bloque les crédits suivants avec une erreur E11000 peu lisible.
    flowPage: {
      type: Number,
      required(this: { type: string }) {
        return this.type === "flow_page";
      },
    },
    refId: Schema.Types.ObjectId, // post, commande, compétence ou tirage concerné
    day: { type: String, default: () => parisDay() },
  },
  createdOnlyOptions,
);

pointEventSchema.index({ userId: 1, createdAt: -1 });
pointEventSchema.index({ userId: 1, day: 1, type: 1 });
// Une page de Flow n'est créditée qu'une fois par utilisateur.
pointEventSchema.index(
  { userId: 1, flowPage: 1 },
  { unique: true, partialFilterExpression: { type: "flow_page" } },
);

export type PointEventDoc = InferSchemaType<typeof pointEventSchema>;
export const PointEvent = defineModel("PointEvent", pointEventSchema);
