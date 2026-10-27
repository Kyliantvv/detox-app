import { db } from "./client";
import { InvalidInputError, isDuplicateKey } from "./errors";
import { type Id, toId } from "./ids";

/** Ids triés et joints : une seule conversation par paire. */
export function conversationPairKey(a: Id, b: Id) {
  return [String(a), String(b)].sort().join(":");
}

/**
 * Seule façon sûre de créer une conversation : renvoie celle de la paire, ou
 * la crée. L'upsert de Prisma n'est pas atomique sur MongoDB : si deux appels
 * créent la même en même temps, le perdant relit celle du gagnant.
 */
export async function findOrCreateConversation(a: Id, b: Id) {
  // Même ordre que conversationPairKey : tri des formes texte.
  const participantIds = [toId(a, "Utilisateur"), toId(b, "Utilisateur")].sort();
  if (participantIds[0] === participantIds[1]) throw new InvalidInputError("Conversation avec soi-même");
  const pairKey = conversationPairKey(participantIds[0], participantIds[1]);
  try {
    return await db.conversation.upsert({ where: { pairKey }, create: { pairKey, participantIds }, update: {} });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return db.conversation.findUniqueOrThrow({ where: { pairKey } });
  }
}
