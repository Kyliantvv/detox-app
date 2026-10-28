import type { ConversationItem } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { conversation, conversationKey, db, formatAgo } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { author } from "@/lib/server/views";

// Conversations : fils existants plus ceux amorcés par les comptes seedés.
export const GET = route((request) => {
  const user = requireUser(request);
  const store = db();
  const now = Date.now();
  const others = new Set<string>();
  for (const key of store.messages.keys()) {
    const [a, b] = key.split("__");
    if (a === user.id) others.add(b);
    else if (b === user.id) others.add(a);
  }
  for (const other of store.users.values()) if (other.bot && other.id !== user.id) others.add(other.id);

  const items = [...others]
    .map((otherId): ConversationItem | null => {
      const other = store.users.get(otherId);
      const visible = conversation(user.id, otherId).filter((message) => message.at <= now);
      const last = visible.at(-1);
      if (!other || !last) return null;
      const readAt = store.reads.get(`${user.id}:${conversationKey(user.id, otherId)}`) ?? 0;
      return {
        id: otherId,
        user: author(other),
        preview: last.text,
        fromMe: last.senderId === user.id,
        ago: formatAgo(last.at, now),
        at: last.at,
        unread: last.senderId !== user.id && last.at > readAt,
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.at - a.at);
  return json({ items });
});
