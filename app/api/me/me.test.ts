import { describe, expect, it } from "vitest";
import { BIO_MAX } from "@/lib/validation";
import { accountOf } from "@/lib/server/db";
import { advanceTime, apiError, call, freezeTime } from "@/test/api";
import { GET, PATCH } from "./route";

describe("GET /api/me", () => {
  it("renvoie le profil, l'e-mail et les stats du compte connecté", async () => {
    const res = await call(GET, { as: "alex" });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: "alex",
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
    expect(res.body.stats.events).toHaveLength(2);
  });

  it("n'expose pas le hash du mot de passe", async () => {
    const res = await call(GET, { as: "alex" });

    expect(JSON.stringify(res.body)).not.toMatch(/hash/i);
  });

  it("cumule le temps actif entre deux requêtes rapprochées seulement", async () => {
    freezeTime();
    await call(GET, { as: "alex" });

    advanceTime(2 * 60_000);
    await call(GET, { as: "alex" });
    advanceTime(30 * 60_000);
    const res = await call(GET, { as: "alex" });

    expect(res.body.stats.timeSpentMs).toBe(2 * 60_000);
  });
});

describe("PATCH /api/me", () => {
  it("modifie la bio sans les espaces autour", async () => {
    const res = await call(PATCH, { as: "alex", method: "PATCH", body: { bio: "  Plus que 3 scrolls.  " } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: "alex", email: "alex@detox.test", username: "alex.detox", bio: "Plus que 3 scrolls." },
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
    expect(accountOf("alex").points).toBe(2455);
  });
});
