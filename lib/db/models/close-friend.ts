import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel, rejectSelfReference } from "../schema-options";

// Cercle proche de `ownerId` : décide qui voit ses posts `closeFriends`.
// Séparé de Follow : la liste appartient à son propriétaire, et un ami proche
// n'a pas à être suivi.
const closeFriendSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    friendId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  createdOnlyOptions,
);

closeFriendSchema.index({ ownerId: 1, friendId: 1 }, { unique: true });
rejectSelfReference(closeFriendSchema, "ownerId", "friendId", "On n'est pas son propre ami proche");

export type CloseFriendDoc = InferSchemaType<typeof closeFriendSchema>;
export const CloseFriend = defineModel("CloseFriend", closeFriendSchema);
