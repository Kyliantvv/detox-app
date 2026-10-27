import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel, rejectSelfReference } from "../schema-options";

// Mon cercle. Le cercle proche est dans CloseFriend.
const followSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followingId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  createdOnlyOptions,
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
followSchema.index({ followingId: 1 });
rejectSelfReference(followSchema, "followerId", "followingId", "On ne se suit pas soi-même");

export type FollowDoc = InferSchemaType<typeof followSchema>;
export const Follow = defineModel("Follow", followSchema);
