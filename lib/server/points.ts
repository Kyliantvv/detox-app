// Économie de points côté serveur, au-dessus de creditPoints/spendPoints (lib/db) :
// chaque gain ou débit écrit un PointEvent. Les montants viennent toujours d'ici, jamais du client.
import { POINTS, comboMultiplier } from "../game";
import type { PointEvent } from "../types";
import {
  bumpCombo,
  creditPoints,
  db,
  InsufficientPointsError,
  isDuplicateKey,
  parisDay,
  spendPoints,
  type PointEvent as DbPointEvent,
  type PointEventType,
  type Tx,
} from "../db";
import { ApiError } from "./http";

type Opts = { combo?: boolean; refId?: string; flowPage?: number; tx?: Tx };

// Forme du contrat d'API (toast de gain, historique du Bilan).
export const pointEvent = (event: DbPointEvent): PointEvent => ({
  id: event.id,
  amount: event.amount,
  label: event.label,
  at: event.createdAt.getTime(),
});

// Crédite `amount` points. Avec `combo`, l'action compte dans le combo en cours et le gain est multiplié.
export async function credit(userId: string, amount: number, type: PointEventType, label: string, opts: Opts = {}) {
  const { combo, ...rest } = opts;
  let finalAmount = amount;
  let finalLabel = label;
  if (combo) {
    const multiplier = comboMultiplier(await bumpCombo(userId));
    if (multiplier > 1) {
      finalAmount = Math.round(amount * multiplier);
      finalLabel = `${label} · combo ×${multiplier}`;
    }
  }
  const event = await creditPoints(userId, finalAmount, type, { ...rest, label: finalLabel });
  return event ? [pointEvent(event)] : [];
}

// Débit conditionnel (`points >= amount`) : deux achats simultanés ne passent pas le solde sous 0.
export async function debit(userId: string, amount: number, type: PointEventType, label: string, opts: Opts = {}) {
  try {
    return pointEvent(await spendPoints(userId, amount, type, { ...opts, label }));
  } catch (error) {
    if (!(error instanceof InsufficientPointsError)) throw error;
    const { points } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
    throw new ApiError("INSUFFICIENT_POINTS", `Il te manque ${amount - points} pts. Retourne scroller.`);
  }
}

// Connexion : série, bienvenue et bonus quotidien (une fois par jour, garanti par un index unique).
export async function startSession(userId: string, firstTime: boolean): Promise<PointEvent[]> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { streak: true } });
  const day = parisDay();
  const yesterday = parisDay(new Date(Date.now() - 86_400_000));
  const streak = user.streak ?? { current: 0, best: 0, lastLoginDay: null };
  if (streak.lastLoginDay !== day) {
    const current = streak.lastLoginDay === yesterday ? streak.current + 1 : 1;
    await db.user.update({
      where: { id: userId },
      data: { streak: { set: { current, best: Math.max(streak.best, current), lastLoginDay: day } } },
    });
  }
  const gains: PointEvent[] = [];
  if (firstTime) gains.push(...(await credit(userId, POINTS.welcome, "welcome", "Cadeau de bienvenue")));
  try {
    gains.push(...(await credit(userId, POINTS.dailyLogin, "daily_login", "Connexion du jour")));
  } catch (error) {
    // Déjà crédité aujourd'hui.
    if (!isDuplicateKey(error)) throw error;
  }
  return gains;
}

// Réponse commune aux actions qui rapportent des points (pour le toast de gain).
export async function withPoints(userId: string, gains: PointEvent[]) {
  const { points } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
  return { points, gains };
}
