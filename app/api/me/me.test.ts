import { describe, expect, it } from "vitest";
import { db, IDLE_GAP_MS, parisDay } from "@/lib/db";
import { BIO_MAX } from "@/lib/validation";
import { advanceTime, apiError, call, freezeTime } from "@/test/api";
import { USERS, userRow } from "@/test/db";
import { GET, PATCH } from "./route";

describe("GET /api/me", () => {
  it("renvoie le profil, l'e-mail et les stats du compte connecté", async () => {
    const res = await call(GET, { as: "alex" });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: USERS.alex,
      username: "alex.detox",
      name: "Alex",
      email: "alex@detox.test",
      bio: expect.any(String),
      status: "En ligne",
      level: 10,
      hasInstant: false,
      shielded: false,
      followers: 0,
      following: 4,
    });
    expect(res.body.stats).toMatchObject({ points: 2455, totalEarned: 2455, totalSpent: 0, streak: 5, serenity: 100 });
    expect(res.body.stats.events.map((event: { label: string }) => event.label)).toEqual([
      "Points des jours précédents",
      "Cadeau de bienvenue",
    ]);
  });

  it("n'expose pas le hash du mot de passe", async () => {
    const res = await call(GET, { as: "alex" });

    expect(JSON.stringify(res.body)).not.toMatch(/hash/i);
  });

  it("cumule le temps actif entre deux requêtes rapprochées seulement", async () => {
    freezeTime();
    await call(GET, { as: "alex" });

    advanceTime(IDLE_GAP_MS - 1000);
    await call(GET, { as: "alex" });
    advanceTime(30 * 60_000);
    const res = await call(GET, { as: "alex" });

    expect(res.body.stats.timeSpentMs).toBe(IDLE_GAP_MS - 1000);
  });

  it("calcule les stats depuis le journal de points", async () => {
    await db.pointEvent.create({
      data: { userId: USERS.alex, amount: -300, type: "shop_purchase", label: "Achat", day: parisDay() },
    });

    const res = await call(GET, { as: "alex" });

    expect(res.body.stats).toMatchObject({ totalSpent: 300, bestGain: 1955, dosesGiven: 0, orders: 0, friendsSpied: 0 });
  });
});

describe("PATCH /api/me", () => {
  it("modifie la bio sans les espaces autour", async () => {
    const res = await call(PATCH, { as: "alex", method: "PATCH", body: { bio: "  Plus que 3 scrolls.  " } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: USERS.alex, email: "alex@detox.test", username: "alex.detox", bio: "Plus que 3 scrolls." },
    });
    expect((await call(GET, { as: "alex" })).body.user.bio).toBe("Plus que 3 scrolls.");
  });

  it("accepte une bio de longueur maximale et un corps vide", async () => {
    expect((await call(PATCH, { as: "alex", method: "PATCH", body: { bio: "x".repeat(BIO_MAX) } })).status).toBe(200);
    expect((await call(PATCH, { as: "alex", method: "PATCH", body: {} })).body.user.bio).toBe("x".repeat(BIO_MAX));
  });

  it.each([
    ["une bio trop longue", { bio: "x".repeat(BIO_MAX + 1) }, `Bio : ${BIO_MAX} caractères maximum.`],
    ["une bio qui n'est pas une chaîne", { bio: 42 }, "Champ « bio » : string attendu."],
  ])("refuse %s", async (_, body, message) => {
    const res = await call(PATCH, { as: "alex", method: "PATCH", body });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
  });

  it("refuse que le client fixe lui-même son solde", async () => {
    const res = await call(PATCH, { as: "alex", method: "PATCH", body: { points: 1_000_000 } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", "Champ(s) inconnu(s) : points."));
    expect((await userRow("alex")).points).toBe(2455);
  });
});
