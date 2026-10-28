import { describe, expect, it } from "vitest";
import { POINTS } from "@/lib/game";
import { db } from "@/lib/db";
import { advanceTime, apiError, call, freezeTime } from "@/test/api";
import { USERS, userRow } from "@/test/db";
import * as follows from "../follows/route";
import * as me from "../me/route";
import * as login from "./login/route";
import * as register from "./register/route";

const ALEX = { email: "alex@detox.test", password: "demo1234" };
const NEW_ACCOUNT = { email: "Bob@Example.com ", username: "bob_42", password: "secret1" };

describe("POST /api/auth/login", () => {
  it("connecte un compte seedé et renvoie un token utilisable sur l'API", async () => {
    const res = await call(login.POST, { body: ALEX });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user: { id: USERS.alex, email: "alex@detox.test", username: "alex.detox" },
      token: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
    });
    const profile = await call(me.GET, { token: res.body.token });
    expect(profile.status).toBe(200);
    expect(profile.body.user.username).toBe("alex.detox");
  });

  it("crédite la connexion du jour une seule fois et prolonge la série", async () => {
    const first = await call(login.POST, { body: ALEX });
    const second = await call(login.POST, { body: ALEX });

    expect(first.body.gains).toEqual([expect.objectContaining({ amount: POINTS.dailyLogin, label: "Connexion du jour" })]);
    expect(first.body.points).toBe(2455 + POINTS.dailyLogin);
    expect(second.body.gains).toEqual([]);
    expect(second.body.points).toBe(first.body.points);
    // Le compte démo s'est connecté hier, 5e jour de série.
    expect((await userRow("alex")).streak).toMatchObject({ current: 6, best: 6 });
  });

  it("remet la série à 1 après un jour sans connexion", async () => {
    freezeTime();
    await call(login.POST, { body: ALEX });

    advanceTime(2 * 86_400_000);
    const res = await call(login.POST, { body: ALEX });

    expect(res.body.gains).toHaveLength(1);
    expect((await userRow("alex")).streak?.current).toBe(1);
  });

  it("accepte l'e-mail sans tenir compte de la casse ni des espaces", async () => {
    const res = await call(login.POST, { body: { ...ALEX, email: "  ALEX@Detox.test " } });

    expect(res.status).toBe(200);
  });

  it.each([
    ["un mauvais mot de passe", { ...ALEX, password: "demo12345" }],
    ["un e-mail inconnu", { email: "personne@detox.test", password: "demo1234" }],
  ])("répond 401 avec le même message pour %s", async (_, body) => {
    const res = await call(login.POST, { body });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(apiError("UNAUTHORIZED", "E-mail ou mot de passe incorrect."));
  });

  it.each([
    ["un JSON invalide", "{email:", "Corps JSON invalide."],
    ["un tableau", "[]", "Le corps doit être un objet JSON."],
    ["un champ manquant", { email: ALEX.email }, "Champ « password » : string attendu."],
    ["un champ mal typé", { ...ALEX, password: 1234 }, "Champ « password » : string attendu."],
    ["un champ inconnu", { ...ALEX, remember: true }, "Champ(s) inconnu(s) : remember."],
  ])("refuse %s", async (_, body, message) => {
    const res = await call(login.POST, { body });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
  });
});

describe("POST /api/auth/register", () => {
  it("crée le compte, normalise l'e-mail et offre les points de bienvenue", async () => {
    const res = await call(register.POST, { body: NEW_ACCOUNT });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.any(String), email: "bob@example.com", username: "bob_42" });
    expect(res.body.gains.map((gain: { label: string }) => gain.label)).toEqual(["Cadeau de bienvenue", "Connexion du jour"]);
    expect(res.body.points).toBe(POINTS.welcome + POINTS.dailyLogin);
  });

  it("ne renvoie jamais le hash du mot de passe", async () => {
    const res = await call(register.POST, { body: NEW_ACCOUNT });

    expect(JSON.stringify(res.body)).not.toMatch(/hash|secret1/i);
    const { passwordHash } = await db.user.findUniqueOrThrow({ where: { id: res.body.user.id }, omit: { passwordHash: false } });
    expect(passwordHash).not.toContain("secret1");
  });

  it("abonne le nouveau compte aux comptes par défaut", async () => {
    const { body } = await call(register.POST, { body: NEW_ACCOUNT });

    const res = await call(follows.GET, { token: body.token });

    expect(res.body.items.sort()).toEqual([USERS.lina, USERS.karim, USERS.ines, USERS.noah].sort());
  });

  it("permet ensuite de se connecter avec le même mot de passe", async () => {
    await call(register.POST, { body: NEW_ACCOUNT });

    const res = await call(login.POST, { body: { email: "bob@example.com", password: "secret1" } });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("bob_42");
  });

  it.each([
    ["EMAIL_ALREADY_USED", { email: "ALEX@detox.test" }, "Cet e-mail est déjà utilisé."],
    ["USERNAME_ALREADY_USED", { username: "LINA.M" }, "Ce nom d'utilisateur est déjà pris."],
  ])("répond 409 %s, sans tenir compte de la casse", async (code, override, message) => {
    const res = await call(register.POST, { body: { ...NEW_ACCOUNT, ...override } });

    expect(res.status).toBe(409);
    expect(res.body).toEqual(apiError(code, message));
  });

  it.each([
    ["un e-mail invalide", { email: "bob@example" }],
    ["un nom trop court", { username: "bo" }],
    ["un nom trop long", { username: "b".repeat(31) }],
    ["un nom avec des espaces", { username: "bob 42" }],
    ["un mot de passe trop court", { password: "12345" }],
  ])("répond 400 pour %s", async (_, override) => {
    const before = await db.user.count();

    const res = await call(register.POST, { body: { ...NEW_ACCOUNT, ...override } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT"));
    expect(await db.user.count()).toBe(before);
  });
});
