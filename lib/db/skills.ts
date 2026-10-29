import type { Skill } from "@prisma/client";
import { type Id, inTransaction, toId } from "./ids";
import { spendPoints } from "./points";

/** Les 10 compétences de Clairvoyance et leur prix. */
export const SKILLS: Record<Skill, number> = {
  last_seen: 100,
  balance: 150,
  streak: 150,
  scroll_time: 200,
  recent_orders: 250,
  profile_visits: 250,
  best_gain: 300,
  peak_hours: 350,
  close_circle: 400,
  full_dossier: 800,
};

/**
 * Achète une compétence Clairvoyance au prix de SKILLS : débit et achat dans
 * la même transaction. Lève InsufficientPointsError si le solde ne suffit pas,
 * et une erreur de doublon (`isDuplicateKey`) si elle est déjà achetée sur
 * cette cible ; aucun point n'est débité dans ces deux cas.
 */
export function buySkill(buyerId: Id, targetId: Id, skill: Skill, label?: string) {
  const data = { buyerId: toId(buyerId, "Utilisateur"), targetId: toId(targetId, "Cible"), skill, price: SKILLS[skill] };
  return inTransaction(undefined, async (tx) => {
    const purchase = await tx.skillPurchase.create({ data });
    const event = await spendPoints(data.buyerId, data.price, "skill_purchase", { refId: purchase.id, label, tx });
    return { purchase, event };
  });
}
