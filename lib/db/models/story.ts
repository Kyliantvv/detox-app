import { type InferSchemaType, Schema } from "mongoose";
import { createdOnlyOptions, defineModel } from "../schema-options";

const DAY_MS = 24 * 60 * 60 * 1000;

// Instant. Mongo supprime le document à `expiresAt` (index TTL).
const storySchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mediaPath: { type: String, required: true },
    mediaMime: { type: String, required: true },
    viewerIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    expiresAt: { type: Date, default: () => new Date(Date.now() + DAY_MS) },
  },
  createdOnlyOptions,
);

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ authorId: 1, createdAt: -1 });

export type StoryDoc = InferSchemaType<typeof storySchema>;
export const Story = defineModel("Story", storySchema);
