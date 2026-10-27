import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel } from "../schema-options";

// Signet : onglet « enregistrés » du profil.
const saveSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  },
  createdOnlyOptions,
);

saveSchema.index({ userId: 1, postId: 1 }, { unique: true });
saveSchema.index({ userId: 1, createdAt: -1 });

export type SaveDoc = InferSchemaType<typeof saveSchema>;
export const Save = defineModel("Save", saveSchema);
