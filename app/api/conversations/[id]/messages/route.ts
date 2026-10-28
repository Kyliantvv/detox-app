import { AUTO_REPLIES } from "@/lib/server/seed";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { conversation, conversationKey, db, uid } from "@/lib/server/db";
import { ApiError, assertId, json, readBody, route } from "@/lib/server/http";
import { publicUser } from "@/lib/server/views";
import { MESSAGE_MAX } from "@/lib/validation";

type Ctx = RouteContext<"/api/conversations/[id]/messages">;
const REPLY_DELAY_MS = 1400;

async function resolve(request: NextRequest, ctx: Ctx) {
  const user = requireUser(request);
  const { id } = await ctx.params;
  const other = db().users.get(assertId(id));
  if (!other || other.id === user.id) throw new ApiError("NOT_FOUND", "Conversation introuvable.");
  return { user, other };
}

// Lu en polling : les réponses programmées n'apparaissent qu'une fois leur heure passée.
export const GET = route(async (request, ctx: Ctx) => {
  const { user, other } = await resolve(request, ctx);
  const now = Date.now();
  const items = conversation(user.id, other.id)
    .filter((message) => message.at <= now)
    .map(({ id, senderId, text, at }) => ({ id, from: senderId === user.id ? "me" : "them", text, at }));
  db().reads.set(`${user.id}:${conversationKey(user.id, other.id)}`, now);
  return json({ user: publicUser(other, user.id), items });
});

export const POST = route(async (request, ctx: Ctx) => {
  const { user, other } = await resolve(request, ctx);
  const { text } = await readBody(request, { text: "string" });
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MESSAGE_MAX) {
    throw new ApiError("INVALID_INPUT", `Message : 1 à ${MESSAGE_MAX} caractères.`);
  }
  const thread = conversation(user.id, other.id);
  const now = Date.now();
  const message = { id: uid(), senderId: user.id, text: trimmed, at: now };
  thread.push(message);
  // Les comptes seedés répondent tout seuls, sans timer côté serveur.
  if (other.bot) {
    thread.push({
      id: uid(),
      senderId: other.id,
      text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
      at: now + REPLY_DELAY_MS,
    });
  }
  return json({ message: { id: message.id, from: "me", text: message.text, at: message.at } }, 201);
});
