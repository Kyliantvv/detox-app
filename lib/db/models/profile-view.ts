import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel } from "../schema-options";

// Alimente la compétence Clairvoyance « Visites de profil ».
const profileViewSchema = new Schema(
  {
    viewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    profileId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  createdOnlyOptions,
);

profileViewSchema.index({ profileId: 1, createdAt: -1 });

export type ProfileViewDoc = InferSchemaType<typeof profileViewSchema>;
export const ProfileView = defineModel("ProfileView", profileViewSchema);
