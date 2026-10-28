import { describe, expect, it, vi } from "vitest";
import { comboMultiplier, drawTicketCells, fakeTracking, levelFor, ticketWinnings } from "./game";

describe("levelFor", () => {
  it.each([
    [0, 1],
    [249, 1],
    [250, 2],
    [2455, 10],
  ])("%i pts gagnés → niveau %i", (totalEarned, level) => {
    expect(levelFor(totalEarned)).toBe(level);
  });
});

describe("comboMultiplier", () => {
  it.each([
    [0, 1],
    [4, 1],
    [5, 1.5],
    [9, 1.5],
    [10, 2],
    [20, 3],
    [500, 3],
  ])("%i actions enchaînées → ×%d", (count, multiplier) => {
    expect(comboMultiplier(count)).toBe(multiplier);
  });
});

describe("ticketWinnings", () => {
  it.each([
    [[500, 500, 500, 0, 50, 100], 500],
    [[50, 1000, 50, 1000, 50, 1000], 1000],
    [[200, 200, 200, 200, 0, 0], 200],
    [[500, 500, 0, 0, 50, 100], 0],
    [[0, 0, 0, 50, 100, 200], 0],
  ])("%j rapporte %i", (cells, win) => {
    expect(ticketWinnings({ cells })).toBe(win);
  });
});

describe("drawTicketCells", () => {
  const VALUES = [0, 50, 100, 200, 500, 1000];

  it("tire 6 cases parmi les valeurs du barème, dont au moins deux identiques", () => {
    for (let i = 0; i < 200; i++) {
      const cells = drawTicketCells();
      const counts = Object.values(Object.groupBy(cells, String)).map((group) => group!.length);

      expect(cells).toHaveLength(6);
      expect(cells.every((value) => VALUES.includes(value))).toBe(true);
      expect(Math.max(...counts)).toBeGreaterThanOrEqual(2);
    }
  });

  it("place trois fois l'appât quand le tirage le décide", () => {
    // 0,1 < 0,12 : la dernière case reprend l'appât ; floor(0,1 × 3) = 0 → appât 200.
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    expect(ticketWinnings({ cells: drawTicketCells() })).toBe(200);
  });
});

describe("fakeTracking", () => {
  it("génère un numéro de suivi fictif", () => {
    expect(fakeTracking()).toMatch(/^DTX-\d{6}-FR$/);
  });
});
