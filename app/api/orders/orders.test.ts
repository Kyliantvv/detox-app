import { describe, expect, it, vi } from "vitest";
import { FAKE_ADDRESSES } from "@/lib/server/seed";
import { accountOf, db } from "@/lib/server/db";
import { apiError, call } from "@/test/api";
import * as me from "../me/route";
import { GET, POST } from "./route";

const buy = (itemId: string) => call(POST, { as: "alex", body: { itemId } });

describe("GET /api/orders", () => {
  it("est vide tant que rien n'a été acheté", async () => {
    const res = await call(GET, { as: "alex" });

    expect(res.body).toEqual({ items: [] });
  });
});

describe("POST /api/orders", () => {
  it("débite le prix et crée une commande fictive", async () => {
    const res = await buy("sucre");

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      kind: "order",
      order: {
        id: expect.any(String),
        itemId: "sucre",
        itemName: "Sachet de sucre",
        price: 150,
        tracking: expect.stringMatching(/^DTX-\d{6}-FR$/),
        address: expect.toBeOneOf(FAKE_ADDRESSES),
        at: expect.any(Number),
      },
      points: 2455 - 150,
      gains: [],
    });
    expect((await call(GET, { as: "alex" })).body.items).toEqual([res.body.order]);
  });

  it("met à jour les stats et l'historique des points", async () => {
    await buy("cigarettes");

    const { stats } = (await call(me.GET, { as: "alex" })).body;

    expect(stats).toMatchObject({ points: 1455, totalSpent: 1000, orders: 1 });
    expect(stats.events[0]).toMatchObject({ amount: -1000, label: "Achat : Paquet de cigarettes" });
  });

  it("refuse l'achat sans assez de points, sans rien débiter", async () => {
    accountOf("alex").points = 100;

    const res = await buy("sucre");

    expect(res.status).toBe(409);
    expect(res.body).toEqual(apiError("INSUFFICIENT_POINTS", "Il te manque 50 pts. Retourne scroller."));
    expect(accountOf("alex").points).toBe(100);
    expect(db().orders.get("alex")).toBeUndefined();
  });

  it("répond 404 pour un article inconnu", async () => {
    const res = await buy("caviar");

    expect(res.status).toBe(404);
    expect(res.body).toEqual(apiError("NOT_FOUND", "Article introuvable."));
  });

  it("refuse un prix envoyé par le client", async () => {
    const res = await call(POST, { as: "alex", body: { itemId: "cigarettes", price: 0 } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", "Champ(s) inconnu(s) : price."));
    expect(accountOf("alex").points).toBe(2455);
  });

  describe("loot box", () => {
    // Le lot est LOOT_PRIZES[floor(random × 6)].
    const draw = (random: number) => vi.spyOn(Math, "random").mockReturnValue(random);

    it("peut rapporter des points", async () => {
      draw(0.1);

      const res = await buy("lootbox");

      expect(res.body).toMatchObject({ kind: "lootbox", prize: "+1 000 pts", points: 2455 - 600 + 1000 });
      expect(res.body.gains).toEqual([expect.objectContaining({ amount: 1000, label: "Loot box" })]);
    });

    it("peut livrer un sachet de sucre", async () => {
      draw(0.55);

      const res = await buy("lootbox");

      expect(res.body).toMatchObject({ prize: "Un sachet de sucre", points: 2455 - 600, gains: [] });
      expect((await call(GET, { as: "alex" })).body.items).toEqual([expect.objectContaining({ itemId: "sucre" })]);
    });

    it("peut donner un ticket à gratter", async () => {
      draw(0.7);

      const res = await buy("lootbox");

      expect(res.body.prize).toBe("Un ticket à gratter");
      expect(db().tickets.get("alex")?.paidOut).toBe(false);
    });

    it("peut ne rien donner", async () => {
      draw(0.95);

      const res = await buy("lootbox");

      expect(res.body).toMatchObject({ prize: "Rien. Mais quelle émotion.", points: 2455 - 600, gains: [] });
    });
  });
});
