// Règles du jeu partagées entre le front (démo locale) et les routes API.
import type { Ticket } from "./types";

export const POINTS = {
  flowPage: 10,
  dose: 2,
  reaction: 5,
  dailyLogin: 25,
  chest: 50,
  welcome: 500,
} as const;

export const TICKET_PRICE = 300;
export const FLOW_PER_PAGE = 5;
export const CHEST_EVERY_PAGES = 4;
export const COMBO_WINDOW_MS = 5000;
// Sérénité (sur 100) perdue dans la journée par page de Flow lue et par Bonne dose donnée.
export const SERENITY_LOSS_PER_PAGE = 3;
export const SERENITY_LOSS_PER_LIKE = 1;

export const levelFor = (totalEarned: number) => 1 + Math.floor(totalEarned / 250);

// ×1 puis +0,5 toutes les 5 actions enchaînées, plafonné à ×3.
export const comboMultiplier = (count: number) => Math.min(3, 1 + Math.floor(count / 5) * 0.5);

export const LOOT_PRIZES = [
  { label: "+1 000 pts", points: 1000 },
  { label: "+250 pts", points: 250 },
  { label: "+100 pts", points: 100 },
  { label: "Un sachet de sucre", item: "sucre" as const },
  { label: "Un ticket à gratter", item: "ticket" as const },
  { label: "Rien. Mais quelle émotion.", points: 0 },
];

// Tirage « presque gagnant » : souvent deux valeurs identiques, rarement trois.
export function drawTicketCells(): number[] {
  const values = [0, 50, 100, 200, 500, 1000];
  const pick = () => values[Math.floor(Math.random() * values.length)];
  const teaser = [200, 500, 1000][Math.floor(Math.random() * 3)];
  const cells = [teaser, teaser, pick(), pick(), pick(), Math.random() < 0.12 ? teaser : pick()];
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

export function ticketWinnings(ticket: Pick<Ticket, "cells">): number {
  const counts = new Map<number, number>();
  ticket.cells.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Math.max(0, ...[...counts].filter(([, count]) => count >= 3).map(([value]) => value));
}

export const fakeTracking = () => `DTX-${Math.floor(100000 + Math.random() * 900000)}-FR`;
