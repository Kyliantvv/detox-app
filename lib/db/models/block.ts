import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel, rejectSelfReference } from "../schema-options";

const blockSchema = new Schema(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blockedId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  createdOnlyOptions,
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
blockSchema.index({ blockedId: 1 });
rejectSelfReference(blockSchema, "blockerId", "blockedId", "On ne se bloque pas soi-même");

export type BlockDoc = InferSchemaType<typeof blockSchema>;
export const Block = defineModel("Block", blockSchema);
