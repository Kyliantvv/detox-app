import { describe, expect, it, vi } from "vitest";
import { db, parisDay } from "@/lib/db";
import { CHEST_EVERY_PAGES, POINTS, SERENITY_LOSS_PER_PAGE } from "@/lib/game";
import { apiError, call } from "@/test/api";
import { USERS, postKeys } from "@/test/db";
import * as circle from "./circle/route";
import * as flow from "./flow/route";

describe("GET /api/feed/circle", () => {
  it("renvoie les photos des comptes suivis, sans les reels, du plus récent au plus ancien", async () => {
    const res = await call(circle.GET, { as: "alex" });

    expect(res.status).toBe(200);
    expect(postKeys(res.body.items).slice(0, 4)).toEqual(["c1", "c2", "f0", "f1"]);
    expect(res.body.items.some((post: { isReel: boolean }) => post.isReel)).toBe(false);
    expect(res.body.items[0]).toMatchObject({
      author: { id: USERS.lina, username: "lina.m", name: "Lina" },
      ago: "il y a 3 min",
      doses: 1248,
      dosedByMe: false,
    });
  });

  it("ne garde que les comptes suivis et mes propres posts", async () => {
    await db.follow.deleteMany({ where: { followerId: USERS.alex, followingId: { not: USERS.karim } } });
    const mine = await db.post.create({ data: { authorId: USERS.alex, type: "photo", caption: "À moi" } });

    const res = await call(circle.GET, { as: "alex" });

    expect(res.body.items[0].id).toBe(mine.id);
    expect(res.body.items.slice(1).every((post: { authorId: string }) => post.authorId === USERS.karim)).toBe(true);
  });
});

describe("GET /api/feed/flow", () => {
  // Désactive le bonus aléatoire (tiré si Math.random() < 0,15).
  const noBonus = () => vi.spyOn(Math, "random").mockReturnValue(0.99);
  const read = (page: string) => call(flow.GET, { as: "alex", query: { page } });

  // Le choix des posts est testé dans lib/server/recommend.test.ts.
  it("renvoie 5 posts recommandés et crédite la page", async () => {
    noBonus();

    const res = await read("0");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
    for (const item of res.body.items) expect(item.reason).toEqual(expect.any(String));
    expect(res.body).toMatchObject({
      page: 0,
      nextPage: 1,
      serenity: 100 - SERENITY_LOSS_PER_PAGE,
      points: 2455 + POINTS.flowPage,
    });
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.flowPage, label: "Page 1 du Flow" })]);
  });

  it("lit la page 0 par défaut", async () => {
    noBonus();

    const res = await call(flow.GET, { as: "alex" });

    expect(res.body.page).toBe(0);
  });

  it("ne crédite pas deux fois la même page et la relit à l'identique", async () => {
    noBonus();
    const first = await read("3");

    const res = await read("3");

    expect(res.body.gains).toEqual([]);
    expect(res.body.points).toBe(2455 + POINTS.flowPage);
    expect(res.body.serenity).toBe(100 - SERENITY_LOSS_PER_PAGE);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(first.body.items.map((item: { id: string }) => item.id));
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
    for (let page = 1; page <= 40; page++) {
      await db.pointEvent.create({
        data: { userId: USERS.alex, amount: 10, type: "flow_page", flowPage: 1000 + page, day: parisDay() },
      });
    }

    const res = await read("0");

    expect(res.body.serenity).toBe(0);
  });

  it("n'annonce pas de page suivante après la dernière, et le Flow reprend du début", async () => {
    noBonus();

    const res = await read("10000");

    expect(res.status).toBe(200);
    expect(res.body.nextPage).toBeNull();
    expect(res.body.items).toHaveLength(5);
  });

  it("ne propose pas les posts d'un compte qui n'a pas le droit de les voir", async () => {
    noBonus();
    await db.post.updateMany({ where: { authorId: USERS.lina }, data: { visibility: "closeFriends" } });

    const res = await read("0");

    expect(res.body.items.some((post: { authorId: string }) => post.authorId === USERS.lina)).toBe(false);
  });

  it.each(["-1", "abc", "1.5", "1e3", "", "10001"])("refuse page=%j", async (page) => {
    const res = await read(page);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", "page doit être un entier positif."));
  });
});
