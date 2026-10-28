import { db } from "@/lib/db";
import type { ConversationItem } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { thread } from "@/lib/server/conversations";
import { formatAgo } from "@/lib/server/format";
import { json, route } from "@/lib/server/http";
import { author } from "@/lib/server/views";

// Conversations : fils existants plus ceux amorcés par les comptes `bot`.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const bots = await db.user.findMany({ where: { bot: true, id: { not: user.id } } });
  await Promise.all(bots.map((bot) => thread(user, bot)));

  const now = new Date();
  const conversations = await db.conversation.findMany({ where: { participantIds: { has: user.id } } });
  const otherIds = conversations.map((conversation) => conversation.participantIds.find((id) => id !== user.id)!);
  const others = new Map(
    (await db.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, username: true, displayName: true } })).map(
      (other) => [other.id, other],
    ),
  );
  const items = await Promise.all(
    conversations.map(async (conversation, i): Promise<ConversationItem | null> => {
      const other = others.get(otherIds[i]);
      // Les réponses programmées des bots n'apparaissent qu'une fois leur heure passée.
      const last = await db.message.findFirst({
        where: { conversationId: conversation.id, createdAt: { lte: now } },
        orderBy: { createdAt: "desc" },
      });
      if (!other || !last) return null;
      return {
        id: other.id,
        user: author(other),
        preview: last.text,
        fromMe: last.senderId === user.id,
        ago: formatAgo(last.createdAt, now.getTime()),
        at: last.createdAt.getTime(),
        unread: last.senderId !== user.id && !last.readAt,
      };
    }),
  );
  return json({ items: items.filter((item) => item !== null).sort((a, b) => b.at - a.at) });
});
