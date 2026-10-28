import type { PointEventType } from "@prisma/client";
import type { Tx } from "./client";
import { InsufficientPointsError, InvalidInputError, NotFoundError } from "./errors";
import { type Id, inTransaction, toId } from "./ids";
import { parisDay } from "./time";

// Chaque mouvement de points écrit le solde et son PointEvent dans la même
// transaction : l'un ne peut pas exister sans l'autre.
//
// Sans `tx`, chaque fonction ouvre sa propre transaction. Pour lier le
// mouvement à une autre écriture (achat, commande, tirage), passer le client
// de sa propre transaction : tout est validé ou annulé ensemble (voir buySkill).

// `label` : texte du toast de gain et de l'historique du Bilan.
type Opts = { refId?: Id; label?: string; tx?: Tx };

/**
 * Crédite `amount` points (0 ne fait rien, pratique pour un tirage perdant)
 * et renvoie le PointEvent créé (undefined pour 0).
 * Lève NotFoundError si l'utilisateur n'existe pas.
 * Pour une page de Flow, `flowPage` est obligatoire : un second crédit de la
 * même page lève une erreur de doublon (`isDuplicateKey`) et rien n'est
 * crédité. Idem pour une seconde connexion quotidienne le même jour.
 */
export async function creditPoints(userId: Id, amount: number, type: PointEventType, opts: Opts & { flowPage?: number } = {}) {
  assertInt(amount, 0);
  if (type === "flow_page" && !Number.isInteger(opts.flowPage)) throw new InvalidInputError("flowPage obligatoire pour flow_page");
  if (amount === 0) return;
  const { tx, refId, flowPage, label } = opts;
  const id = toId(userId, "Utilisateur");
  return inTransaction(tx, async (t) => {
    const res = await t.user.updateMany({ where: { id }, data: { points: { increment: amount }, totalEarned: { increment: amount } } });
    if (res.count !== 1) throw new NotFoundError("Utilisateur");
    const now = new Date();
    return t.pointEvent.create({ data: { userId: id, amount, type, label, flowPage, refId, day: parisDay(now), createdAt: now } });
  });
}

/**
 * Débite `amount` points, journalise la dépense (montant négatif) et renvoie le PointEvent.
 * Le filtre `points >= amount` empêche le solde négatif et la double dépense.
 * Lève InsufficientPointsError si le solde ne suffit pas ; rien n'est écrit.
 * Une perte (ticket perdant) passe par ici, jamais par un crédit négatif.
 */
export async function spendPoints(userId: Id, amount: number, type: PointEventType, opts: Opts = {}) {
  assertInt(amount, 1);
  const { tx, refId, label } = opts;
  const id = toId(userId, "Utilisateur");
  return inTransaction(tx, async (t) => {
    const res = await t.user.updateMany({ where: { id, points: { gte: amount } }, data: { points: { decrement: amount } } });
    if (res.count !== 1) throw new InsufficientPointsError();
    const now = new Date();
    return t.pointEvent.create({ data: { userId: id, amount: -amount, type, label, refId, day: parisDay(now), createdAt: now } });
  });
}

function assertInt(amount: number, min: number) {
  if (!Number.isInteger(amount) || amount < min) throw new InvalidInputError("Montant de points invalide");
}
