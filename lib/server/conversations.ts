// Fils de messages entre deux comptes, au-dessus de findOrCreateConversation (lib/db).
import { db, findOrCreateConversation, type Conversation, type UserRow as User } from "../db";
import { STARTER_MESSAGES } from "./content";

const unset = (field: "lastMessageAt" | "readAt") => ({ OR: [{ [field]: null }, { [field]: { isSet: false } }] });
export const notRead = unset("readAt");

// Renvoie le fil entre deux comptes ; amorcé avec les messages de la maquette si l'autre est un compte `bot`.
export async function thread(me: Pick<User, "id">, other: Pick<User, "id" | "username" | "bot">): Promise<Conversation> {
  const conversation = await findOrCreateConversation(me.id, other.id);
  const starters = other.bot ? (STARTER_MESSAGES[other.username] ?? []) : [];
  if (!starters.length || conversation.lastMessageAt) return conversation;
  const start = Date.now() - starters.length * 60_000;
  // Un seul appel amorce le fil, même si deux requêtes arrivent en même temps.
  const claimed = await db.conversation.updateMany({
    where: { AND: [{ id: conversation.id }, unset("lastMessageAt")] },
    data: { lastMessageAt: new Date(start + (starters.length - 1) * 60_000), lastMessagePreview: starters.at(-1)!.text.slice(0, 100) },
  });
  if (claimed.count === 1) {
    await db.message.createMany({
      data: starters.map((message, index) => ({
        conversationId: conversation.id,
        senderId: message.from === "me" ? me.id : other.id,
        text: message.text,
        createdAt: new Date(start + index * 60_000),
      })),
    });
  }
  return db.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
}
