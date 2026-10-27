import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../schema-options";

// Article de L'Épicerie. Rempli par `pnpm db:seed`.
const shopItemSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    // order : fausse commande ; scratch / lootbox : crée un Draw.
    kind: { type: String, enum: ["order", "scratch", "lootbox"], required: true },
    active: { type: Boolean, default: true },
  },
  baseOptions,
);

export type ShopItemDoc = InferSchemaType<typeof shopItemSchema>;
export const ShopItem = defineModel("ShopItem", shopItemSchema);
