import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../schema-options";

// Fausse commande : rien n'est jamais livré.
const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    itemId: { type: Schema.Types.ObjectId, ref: "ShopItem", required: true },
    // Copie au moment de l'achat, au cas où l'article change de prix.
    item: {
      name: { type: String, required: true },
      price: { type: Number, required: true },
    },
    quantity: { type: Number, default: 1, min: 1 },
    fakeAddress: { type: String, required: true },
    trackingNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: ["preparing", "in_transit"], default: "in_transit" },
  },
  baseOptions,
);

orderSchema.index({ userId: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = defineModel("Order", orderSchema);
