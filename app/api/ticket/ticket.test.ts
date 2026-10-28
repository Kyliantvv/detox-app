// Ticket à gratter : achat (POST /api/dice), lecture et grattage case par case.
import { describe, expect, it } from "vitest";
import { TICKET_PRICE } from "@/lib/game";
import { accountOf, db } from "@/lib/server/db";
import { apiError, call } from "@/test/api";
import * as dice from "../dice/route";
import * as scratch from "./scratch/route";
import { GET } from "./route";

const HIDDEN = [null, null, null, null, null, null];

// Ticket choisi par le test plutôt que tiré au sort.
const giveTicket = (cells: number[]) => db().tickets.set("alex", { cells, revealed: cells.map(() => false), paidOut: false });
const scratchCell = (index: unknown) => call(scratch.POST, { as: "alex", body: { index } });

describe("POST /api/dice", () => {
  it("achète un ticket dont les cases restent cachées", async () => {
    const res = await call(dice.POST, { as: "alex", method: "POST" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      kind: "ticket",
      ticket: { cells: HIDDEN, revealed: HIDDEN.map(() => false), paidOut: false, winnings: null },
      points: 2455 - TICKET_PRICE,
      gains: [],
    });
    expect(db().tickets.get("alex")?.cells).toHaveLength(6);
  });

  it("remplace le ticket en cours", async () => {
    giveTicket([500, 500, 500, 0, 0, 0]);

    await call(dice.POST, { as: "alex", method: "POST" });

    expect((await call(GET, { as: "alex" })).body.ticket.cells).toEqual(HIDDEN);
  });

  it("refuse l'achat sans assez de points", async () => {
    accountOf("alex").points = TICKET_PRICE - 1;

    const res = await call(dice.POST, { as: "alex", method: "POST" });

    expect(res.status).toBe(409);
    expect(db().tickets.has("alex")).toBe(false);
  });
});

describe("GET /api/ticket", () => {
  it("répond 404 sans ticket en cours", async () => {
    const res = await call(GET, { as: "alex" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(apiError("NOT_FOUND", "Aucun ticket en cours."));
  });

  it("ne révèle que les cases grattées", async () => {
    giveTicket([1000, 0, 50, 100, 200, 500]);
    await scratchCell(0);

    const res = await call(GET, { as: "alex" });

    expect(res.body.ticket.cells).toEqual([1000, null, null, null, null, null]);
  });
});

describe("POST /api/ticket/scratch", () => {
  it("paie un ticket gagnant une seule fois, à la dernière case", async () => {
    giveTicket([500, 0, 500, 50, 500, 100]);
    for (const index of [0, 1, 2, 3, 4]) expect((await scratchCell(index)).body.gains).toEqual([]);

    const last = await scratchCell(5);
    const again = await scratchCell(5);

    expect(last.body.ticket).toEqual({ cells: [500, 0, 500, 50, 500, 100], revealed: Array(6).fill(true), paidOut: true, winnings: 500 });
    expect(last.body.gains).toEqual([expect.objectContaining({ amount: 500, label: "Ticket gagnant" })]);
    expect(last.body.points).toBe(2455 + 500);
    expect(again.body).toMatchObject({ gains: [], points: 2455 + 500 });
  });

  it("garde la meilleure combinaison quand deux valeurs sortent trois fois", async () => {
    giveTicket([50, 1000, 50, 1000, 50, 1000]);

    for (const index of [0, 1, 2, 3, 4]) await scratchCell(index);
    const res = await scratchCell(5);

    expect(res.body.ticket.winnings).toBe(1000);
  });

  it("ne paie rien sans trois valeurs identiques", async () => {
    giveTicket([500, 500, 0, 0, 50, 100]);

    for (const index of [0, 1, 2, 3, 4]) await scratchCell(index);
    const res = await scratchCell(5);

    expect(res.body).toMatchObject({ ticket: { paidOut: true, winnings: 0 }, gains: [], points: 2455 });
  });

  it.each([
    [6, "index doit être un entier entre 0 et 5."],
    [-1, "index doit être un entier entre 0 et 5."],
    [1.5, "index doit être un entier entre 0 et 5."],
    ["1", "Champ « index » : number attendu."],
  ])("refuse index=%j", async (index, message) => {
    giveTicket([0, 0, 0, 0, 0, 0]);

    const res = await scratchCell(index);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
  });

  it("répond 404 sans ticket en cours", async () => {
    const res = await scratchCell(0);

    expect(res.status).toBe(404);
  });
});
