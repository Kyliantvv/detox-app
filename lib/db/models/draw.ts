import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, jsonOptions } from "../schema-options";

// Tirage serveur : ticket à gratter, loot box ou bonus aléatoire.
// Les valeurs sont tirées à la création ; le client ne fait que révéler.
// Le JSON masque les cases non grattées, le gain et l'objet tant que le tirage est ouvert.
// Nommé DiceRoll dans le dossier (route /api/dice).
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
    // Loot box : objet gagné à la place (ou en plus) des points.
    prizeItemId: { type: Schema.Types.ObjectId, ref: "ShopItem" },
    status: { type: String, enum: ["open", "done"], default: "open" },
  },
  {
    ...baseOptions,
    toJSON: jsonOptions((ret) => {
      const cells = ret.cells as { value?: number; revealed: boolean }[];
      ret.cells = cells.map((c) => (c.revealed ? c : { revealed: false }));
      if (ret.status !== "done") {
        delete ret.payout;
        delete ret.prizeItemId;
      }
    }),
  },
);

drawSchema.index({ userId: 1, status: 1, createdAt: -1 });

export type DrawDoc = InferSchemaType<typeof drawSchema>;
export const Draw = defineModel("Draw", drawSchema);
