import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../schema-options";

// Tirage serveur : ticket à gratter, loot box ou bonus aléatoire.
// Les valeurs sont tirées à la création ; le client ne fait que révéler.
const drawSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["scratch", "lootbox", "bonus"], required: true },
    cost: { type: Number, default: 0, min: 0 },
    cells: {
      type: [{ _id: false, value: Number, revealed: { type: Boolean, default: false } }],
      default: [],
    },
    payout: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "done"], default: "open" },
  },
  baseOptions,
);

drawSchema.index({ userId: 1, status: 1, createdAt: -1 });

export type DrawDoc = InferSchemaType<typeof drawSchema>;
export const Draw = defineModel("Draw", drawSchema);
