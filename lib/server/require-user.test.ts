import { describe, expect, it } from "vitest";
import { advanceTime, freezeTime } from "@/test/api";
import { USERS, userRow } from "@/test/db";
import { requireUser, signToken } from "./auth";
import { ApiError } from "./http";

const bearer = (token: string) => new Request("http://localhost/", { headers: { authorization: `Bearer ${token}` } });

describe("requireUser", () => {
  it("renvoie l'utilisateur du Bearer et note son passage", async () => {
    freezeTime();
    advanceTime(1000);

    const user = await requireUser(bearer(signToken(USERS.lina)));

    expect(user.username).toBe("lina.m");
    expect((await userRow("lina")).lastActiveAt).toEqual(new Date());
  });

  it("compte le temps passé entre deux requêtes rapprochées", async () => {
    freezeTime();
    await requireUser(bearer(signToken(USERS.alex)));

    advanceTime(30_000);
    await requireUser(bearer(signToken(USERS.alex)));

    expect((await userRow("alex")).timeSpentSec).toBe(30);
  });

  it.each([
    ["sans en-tête", new Request("http://localhost/")],
    ["avec un token invalide", bearer("x.y.z")],
    ["pour un compte supprimé", bearer(signToken("0".repeat(24)))],
    ["pour un id mal formé", bearer(signToken("fantome"))],
  ])("lève UNAUTHORIZED %s", async (_, request) => {
    await expect(requireUser(request)).rejects.toThrow(new ApiError("UNAUTHORIZED", "Token manquant ou invalide."));
  });
});
