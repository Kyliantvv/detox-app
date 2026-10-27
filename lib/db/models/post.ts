import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../schema-options";

const postSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["photo", "reel"], required: true },
    mediaPath: { type: String, required: true }, // fichier dans uploads/
    mediaMime: { type: String, required: true },
    caption: { type: String, maxlength: 2200, default: "" },
    location: { type: String, maxlength: 80 },
    tags: { type: [String], default: [] }, // filtres de Recherche (voyage…)
    visibility: { type: String, enum: ["public", "closeFriends"], default: "public" },
    // Compteurs dénormalisés : ne modifier que via lib/db/social.ts.
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
  },
  baseOptions,
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1, createdAt: -1 });

export type PostDoc = InferSchemaType<typeof postSchema>;
export const Post = defineModel("Post", postSchema);
