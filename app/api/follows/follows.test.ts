import { describe, expect, it } from "vitest";
import { apiError, call } from "@/test/api";
import { USERS } from "@/test/db";
import * as user from "../users/[username]/route";
import * as unfollow from "./[targetId]/route";
import { GET, POST } from "./route";

const follow = (targetId: unknown) => call(POST, { as: "alex", body: { targetId } });
const DEFAULT = [USERS.lina, USERS.karim, USERS.ines, USERS.noah];

describe("/api/follows", () => {
  it("liste les comptes suivis", async () => {
    const res = await call(GET, { as: "alex" });

    expect(res.body.items.sort()).toEqual([...DEFAULT].sort());
  });

  it("suit un compte une seule fois et met à jour son profil public", async () => {
    await follow(USERS.sam);
    const res = await follow(USERS.sam);

    expect(res.status).toBe(201);
    expect(res.body.items.filter((id: string) => id === USERS.sam)).toHaveLength(1);
    const profile = await call(user.GET, { as: "alex", params: { username: "sam.off" } });
    expect(profile.body.user).toMatchObject({ followedByMe: true, followers: 5 });
  });

  it.each([
    ["soi-même", USERS.alex, 404, apiError("NOT_FOUND", "Compte introuvable.")],
    ["un compte inconnu", "0".repeat(24), 404, apiError("NOT_FOUND", "Compte introuvable.")],
    ["un id mal formé", "lina/../alex", 400, apiError("INVALID_INPUT", "targetId invalide")],
    ["un id qui n'est pas une chaîne", 7, 400, apiError("INVALID_INPUT", "Champ « targetId » : string attendu.")],
  ])("refuse de suivre %s", async (_, targetId, status, error) => {
    const res = await follow(targetId);

    expect(res.status).toBe(status);
    expect(res.body).toEqual(error);
  });
});

describe("DELETE /api/follows/[targetId]", () => {
  const remove = (targetId: string) => call(unfollow.DELETE, { as: "alex", method: "DELETE", params: { targetId } });

  it("arrête de suivre un compte", async () => {
    const res = await remove(USERS.lina);

    expect(res.status).toBe(200);
    expect(res.body.items.sort()).toEqual([USERS.karim, USERS.ines, USERS.noah].sort());
  });

  it("ne fait rien pour un compte non suivi", async () => {
    const res = await remove(USERS.sam);

    expect(res.body.items.sort()).toEqual([...DEFAULT].sort());
  });

  it("refuse un id mal formé", async () => {
    const res = await remove("a b");

    expect(res.status).toBe(400);
  });
});
