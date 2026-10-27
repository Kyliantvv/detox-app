import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel } from "../schema-options";

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: Date,
  },
  createdOnlyOptions,
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export type MessageDoc = InferSchemaType<typeof messageSchema>;
export const Message = defineModel("Message", messageSchema);
