import { describe, expect, it, vi } from "vitest";
import { CHEST_EVERY_PAGES, POINTS } from "@/lib/game";
import { accountOf, db, followingOf } from "@/lib/server/db";
import { apiError, call } from "@/test/api";
import * as circle from "./circle/route";
import * as flow from "./flow/route";

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("GET /api/feed/circle", () => {
  it("renvoie les posts des comptes suivis, sans les reels, du plus récent au plus ancien", async () => {
    const res = await call(circle.GET, { as: "alex" });

    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(res.body.items[0]).toMatchObject({ author: { id: "lina", username: "lina.m" }, doses: 1248, dosedByMe: false });
  });

  it("ne garde que les comptes suivis et mes propres posts", async () => {
    followingOf("alex").clear();
    followingOf("alex").add("karim");
    db().posts.set("mine", { ...db().posts.get("c1")!, id: "mine", authorId: "alex", createdAt: Date.now() });

    const res = await call(circle.GET, { as: "alex" });

    expect(ids(res.body.items)).toEqual(["mine", "c2"]);
  });
});

describe("GET /api/feed/flow", () => {
  // Désactive le bonus aléatoire (tiré si Math.random() < 0,15).
  const noBonus = () => vi.spyOn(Math, "random").mockReturnValue(0.99);
  const read = (page: string) => call(flow.GET, { as: "alex", query: { page } });

  it("renvoie 5 posts déterministes et crédite la page", async () => {
    noBonus();

    const res = await read("0");

    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual(["f0", "f1", "f2", "f3", "f4"]);
    expect(res.body).toMatchObject({ page: 0, nextPage: 1, serenity: 97, points: 2455 + POINTS.flowPage });
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.flowPage, label: "Page 1 du Flow" })]);
  });

  it("lit la page 0 par défaut", async () => {
    noBonus();

    const res = await call(flow.GET, { as: "alex" });

    expect(res.body.page).toBe(0);
  });

  it("ne crédite pas deux fois la même page", async () => {
    noBonus();
    await read("3");

    const res = await read("3");

    expect(res.body.gains).toEqual([]);
    expect(res.body.points).toBe(2455 + POINTS.flowPage);
    expect(res.body.serenity).toBe(97);
  });

  it(`ouvre un coffre toutes les ${CHEST_EVERY_PAGES} pages lues`, async () => {
    noBonus();
    for (let page = 0; page < CHEST_EVERY_PAGES - 1; page++) await read(String(page * 10));

    const res = await read("100");

    expect(res.body.gains).toContainEqual(expect.objectContaining({ amount: POINTS.chest, label: "Coffre ouvert" }));
  });

  it("applique le combo à partir de 5 actions enchaînées", async () => {
    noBonus();
    for (let page = 0; page < 4; page++) await read(String(page));

    const res = await read("4");

    expect(res.body.gains[0]).toMatchObject({ amount: 15, label: "Page 5 du Flow · combo ×1.5" });
  });

  it("tire parfois un bonus aléatoire", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const res = await read("0");

    expect(res.body.gains).toContainEqual(expect.objectContaining({ amount: 10, label: "Bonus aléatoire" }));
  });

  it("ne descend jamais la sérénité sous 0", async () => {
    noBonus();
    accountOf("alex").serenity = 2;

    const res = await read("0");

    expect(res.body.serenity).toBe(0);
  });

  it("n'annonce pas de page suivante après la dernière", async () => {
    noBonus();

    const res = await read("10000");

    expect(res.status).toBe(200);
    expect(res.body.nextPage).toBeNull();
  });

  it.each(["-1", "abc", "1.5", "1e3", "", "10001"])("refuse page=%j", async (page) => {
    const res = await read(page);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", "page doit être un entier positif."));
  });
});
