import { type InferSchemaType, isValidObjectId, Schema, Types } from "mongoose";
import { baseOptions, defineModel } from "../schema-options";

const conversationSchema = new Schema(
  {
    participantIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      required: true,
      validate: {
        validator: (ids: Types.ObjectId[]) => ids.length === 2 && String(ids[0]) !== String(ids[1]),
        message: "Une conversation relie exactement deux utilisateurs différents",
      },
    },
    // Ids triés et joints : une seule conversation par paire.
    pairKey: { type: String, required: true, unique: true },
    lastMessageAt: Date,
    lastMessagePreview: { type: String, maxlength: 100 },
  },
  baseOptions,
);

export function conversationPairKey(a: Types.ObjectId | string, b: Types.ObjectId | string) {
  return [String(a), String(b)].sort().join(":");
}

conversationSchema.pre("validate", function (this: { participantIds: Types.ObjectId[]; pairKey?: string | null }) {
  const [a, b] = this.participantIds;
  if (a && b) this.pairKey = conversationPairKey(a, b);
});

conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

export type ConversationDoc = InferSchemaType<typeof conversationSchema>;
export const Conversation = defineModel("Conversation", conversationSchema);

// Seule façon sûre de créer une conversation : un upsert sur pairKey.
// `findOneAndUpdate` ne passe pas par le hook `validate`, d'où les contrôles ici.
export async function findOrCreateConversation(a: Types.ObjectId | string, b: Types.ObjectId | string) {
  if (!isValidObjectId(a) || !isValidObjectId(b)) throw new Error("Id utilisateur invalide");
  if (String(a) === String(b)) throw new Error("Conversation avec soi-même");
  const participantIds = [String(a), String(b)].sort().map((id) => new Types.ObjectId(id));
  const pairKey = participantIds.join(":");
  return Conversation.findOneAndUpdate(
    { pairKey },
    { $setOnInsert: { pairKey, participantIds } },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
}
