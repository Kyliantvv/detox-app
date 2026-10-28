const DAY_MS = 24 * 60 * 60 * 1000;

/** `expiresAt` d'une story créée à `now` : Mongo la supprime 24 h après (index TTL). */
export function storyExpiry(now = new Date()) {
  return new Date(now.getTime() + DAY_MS);
}
