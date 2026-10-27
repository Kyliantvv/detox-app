import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel } from "../schema-options";

// Republication d'un post (+5 pts, comme un commentaire).
const repostSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  },
  createdOnlyOptions,
);

repostSchema.index({ userId: 1, postId: 1 }, { unique: true });
repostSchema.index({ postId: 1 });

export type RepostDoc = InferSchemaType<typeof repostSchema>;
export const Repost = defineModel("Repost", repostSchema);
