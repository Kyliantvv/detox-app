import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel, rejectSelfReference } from "../schema-options";

// Les 10 compétences de Clairvoyance et leur prix.
export const SKILLS = {
  last_seen: 100,
  balance: 150,
  streak: 150,
  scroll_time: 200,
  recent_orders: 250,
  profile_visits: 250,
  best_gain: 300,
  peak_hours: 350,
  close_circle: 400,
  full_dossier: 800,
} as const;

export type Skill = keyof typeof SKILLS;

// Achat unique par cible ; la cible n'est jamais notifiée.
const skillPurchaseSchema = new Schema(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: String, enum: Object.keys(SKILLS) as Skill[], required: true },
    price: { type: Number, required: true },
  },
  createdOnlyOptions,
);

skillPurchaseSchema.index({ buyerId: 1, targetId: 1, skill: 1 }, { unique: true });

rejectSelfReference(skillPurchaseSchema, "buyerId", "targetId", "On n'espionne pas son propre compte");

export type SkillPurchaseDoc = InferSchemaType<typeof skillPurchaseSchema>;
export const SkillPurchase = defineModel("SkillPurchase", skillPurchaseSchema);
