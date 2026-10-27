import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../schema-options";

const commentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
  },
  baseOptions,
);

commentSchema.index({ postId: 1, createdAt: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema>;
export const Comment = defineModel("Comment", commentSchema);
