import { type Id, inTransaction, toObjectId } from "./ids";
import { type Skill, SKILLS, SkillPurchase } from "./models/skill-purchase";
import { spendPoints } from "./points";

/**
 * Achète une compétence Clairvoyance au prix de SKILLS : débit et achat dans
 * la même transaction. Lève InsufficientPointsError si le solde ne suffit pas,
 * et une erreur E11000 (`isDuplicateKey`) si elle est déjà achetée sur cette
 * cible ; aucun point n'est débité dans ces deux cas.
 */
export function buySkill(buyerId: Id, targetId: Id, skill: Skill) {
  const doc = { buyerId: toObjectId(buyerId, "Utilisateur"), targetId: toObjectId(targetId, "Cible"), skill };
  return inTransaction(undefined, async (session) => {
    const [purchase] = await SkillPurchase.create([doc], { session });
    await spendPoints(doc.buyerId, SKILLS[skill], "skill_purchase", { refId: purchase._id, session });
    return purchase;
  });
}
