import type { Draw } from "@prisma/client";

/**
 * JSON d'un tirage : masque la valeur des cases non grattées, le gain et
 * l'objet tant que le tirage est ouvert.
 */
export function toDrawJSON(draw: Draw) {
  const { payout, prizeItemId, ...rest } = draw;
  const cells = draw.cells.map((c) => (c.revealed ? c : { revealed: false }));
  return draw.status === "done" ? { ...rest, cells, payout, prizeItemId } : { ...rest, cells };
}
