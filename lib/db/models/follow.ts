import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel, rejectSelfReference } from "../schema-options";

// Mon cercle. `closeFriend` remplace un modèle CloseFriend séparé.
const followSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followingId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    closeFriend: { type: Boolean, default: false },
  },
  createdOnlyOptions,
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
followSchema.index({ followingId: 1 });
rejectSelfReference(followSchema, "followerId", "followingId", "On ne se suit pas soi-même");

export type FollowDoc = InferSchemaType<typeof followSchema>;
export const Follow = defineModel("Follow", followSchema);
