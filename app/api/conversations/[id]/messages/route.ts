import type { NextRequest } from "next/server";
import { db, toId } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { AUTO_REPLIES } from "@/lib/server/content";
import { notRead, thread } from "@/lib/server/conversations";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { publicUser } from "@/lib/server/views";
import { MESSAGE_MAX } from "@/lib/validation";

type Ctx = RouteContext<"/api/conversations/[id]/messages">;
const REPLY_DELAY_MS = 1400;

async function resolve(request: NextRequest, ctx: Ctx) {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const other = await db.user.findUnique({ where: { id: toId(id, "Conversation") } });
  if (!other || other.id === user.id) throw new ApiError("NOT_FOUND", "Conversation introuvable.");
  return { user, other, conversation: await thread(user, other) };
}

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
  const items = messages.map(({ id, senderId, text, createdAt }) => ({
    id,
    from: senderId === user.id ? "me" : "them",
    text,
    at: createdAt.getTime(),
  }));
  return json({ user: await publicUser(other, user.id), items });
});

export const POST = route(async (request, ctx: Ctx) => {
  const { user, other, conversation } = await resolve(request, ctx);
  const { text } = await readBody(request, { text: "string" });
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MESSAGE_MAX) {
    throw new ApiError("INVALID_INPUT", `Message : 1 à ${MESSAGE_MAX} caractères.`);
  }
  const now = new Date();
  const message = await db.message.create({
    data: { conversationId: conversation.id, senderId: user.id, text: trimmed, createdAt: now },
  });
  let last = { at: now, text: trimmed };
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
  return json({ message: { id: message.id, from: "me", text: message.text, at: now.getTime() } }, 201);
});
