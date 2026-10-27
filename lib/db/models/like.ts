import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel } from "../schema-options";

// Bonne dose.
const likeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  },
  createdOnlyOptions,
);

likeSchema.index({ userId: 1, postId: 1 }, { unique: true });
likeSchema.index({ postId: 1 });

export type LikeDoc = InferSchemaType<typeof likeSchema>;
export const Like = defineModel("Like", likeSchema);
