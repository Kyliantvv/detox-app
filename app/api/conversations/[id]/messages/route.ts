import type { NextRequest } from "next/server";
import { db, toId, type Message } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { AUTO_REPLIES } from "@/lib/server/content";
import { messagePreview, notRead, thread } from "@/lib/server/conversations";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { claimMedia } from "@/lib/server/media";
import { MEDIA_TYPES } from "@/lib/media-types";
import { publicUser } from "@/lib/server/views";
import type { ChatMessage } from "@/lib/types";
import { MESSAGE_MAX, MESSAGE_MEDIA_MAX } from "@/lib/validation";

type Ctx = RouteContext<"/api/conversations/[id]/messages">;
const REPLY_DELAY_MS = 1400;

const messageView = (message: Message, userId: string): ChatMessage => ({
  id: message.id,
  from: message.senderId === userId ? "me" : "them",
  text: message.text,
  ...(message.media.length ? { media: message.media } : {}),
  at: message.createdAt.getTime(),
});

async function resolve(request: NextRequest, ctx: Ctx) {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const other = await db.user.findUnique({ where: { id: toId(id, "Conversation") } });
  if (!other || other.id === user.id) throw new ApiError("NOT_FOUND", "Conversation introuvable.");
  return { user, other, conversation: await thread(user, other) };
}

/**
 * @openapi
 * /api/conversations/{id}/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Messages d'une conversation
 *     description: Lu en polling. Marque comme lus les messages reçus. Les réponses programmées des bots n'apparaissent qu'une fois leur heure passée.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string }, description: Id de l'autre compte }
 *     responses:
 *       '200': { description: Messages, du plus ancien au plus récent, content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/PublicUser' }, items: { type: array, items: { $ref: '#/components/schemas/ChatMessage' } } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *   post:
 *     tags: [Messages]
 *     summary: Envoyer un message
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string }, description: Id de l'autre compte }
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, additionalProperties: false, description: 'Un texte, des médias ou les deux. Un message vocal part seul (avec un texte au besoin).', properties: { text: { type: string, maxLength: 1000 }, mediaKeys: { type: array, maxItems: 10, items: { type: string }, description: 'Clés rendues par /api/files : photos et vidéos, ou un seul fichier audio (message vocal)' } } } } } }
 *     responses:
 *       '201': { description: Message envoyé, content: { application/json: { schema: { type: object, properties: { message: { $ref: '#/components/schemas/ChatMessage' } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
// Lu en polling : les réponses programmées n'apparaissent qu'une fois leur heure passée.
export const GET = route(async (request, ctx: Ctx) => {
  const { user, other, conversation } = await resolve(request, ctx);
  const now = new Date();
  const messages = await db.message.findMany({
    where: { conversationId: conversation.id, createdAt: { lte: now } },
    orderBy: { createdAt: "asc" },
  });
  await db.message.updateMany({
    where: { AND: [{ conversationId: conversation.id, senderId: other.id, createdAt: { lte: now } }, notRead] },
    data: { readAt: now },
  });
  return json({ user: await publicUser(other, user.id), items: messages.map((message) => messageView(message, user.id)) });
});

export const POST = route(async (request, ctx: Ctx) => {
  const { user, other, conversation } = await resolve(request, ctx);
  const { text = "", mediaKeys = [] } = await readBody(request, { text: "string?", mediaKeys: "string[]?" });
  const trimmed = text.trim();
  if (trimmed.length > MESSAGE_MAX || (!trimmed && !mediaKeys.length)) {
    throw new ApiError("INVALID_INPUT", `Message : 1 à ${MESSAGE_MAX} caractères.`);
  }
  if (mediaKeys.length > MESSAGE_MEDIA_MAX) {
    throw new ApiError("INVALID_INPUT", `${MESSAGE_MEDIA_MAX} photos ou vidéos maximum par message.`);
  }
  const now = new Date();
  // Fichiers envoyés par /api/files, réservés comme pour un post. Un message vocal part seul.
  const media = await claimMedia(
    user.id,
    mediaKeys,
    now,
    mediaKeys.length > 1 ? { types: MEDIA_TYPES, refused: "Un message vocal part seul." } : {},
  );
  const message = await db.message.create({
    data: { conversationId: conversation.id, senderId: user.id, text: trimmed, media, createdAt: now },
  });
  let last = { at: now, text: messagePreview(message) };
  // Les comptes `bot` répondent tout seuls, sans timer côté serveur : la réponse est datée dans le futur.
  if (other.bot) {
    const reply = { at: new Date(now.getTime() + REPLY_DELAY_MS), text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)] };
    await db.message.create({ data: { conversationId: conversation.id, senderId: other.id, text: reply.text, createdAt: reply.at } });
    last = reply;
  }
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: last.at, lastMessagePreview: last.text.slice(0, 100) },
  });
  return json({ message: messageView(message, user.id) }, 201);
});
