import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../schema-options";

// order : fausse commande ; scratch / lootbox : crée un Draw.
export const SHOP_ITEM_KINDS = ["order", "scratch", "lootbox"] as const;
export type ShopItemKind = (typeof SHOP_ITEM_KINDS)[number];

// Article de L'Épicerie. Rempli par `pnpm db:seed`.
const shopItemSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: SHOP_ITEM_KINDS, required: true },
    active: { type: Boolean, default: true },
  },
  baseOptions,
);

export type ShopItemDoc = InferSchemaType<typeof shopItemSchema>;
export const ShopItem = defineModel("ShopItem", shopItemSchema);
