import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { advanceTime, call, freezeTime } from "@/test/api";
import { USERS } from "@/test/db";
import { GET } from "./route";

describe("GET /api/stories", () => {
  it("liste les comptes suivis, ceux qui ont un Instant en premier", async () => {
    const res = await call(GET, { as: "alex" });

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([USERS.lina, USERS.karim, USERS.ines, USERS.noah]);
    expect(res.body.items[1]).toEqual({
      id: USERS.karim,
      username: "karim.zen",
      name: "Karim",
      instant: { art: "ring", text: "14 jours de série. Je ne sens plus mon pouce.", ago: "il y a 40 min" },
    });
    expect(res.body.items[3].instant).toBeNull();
  });

  it("fait disparaître les Instants après 24 h, sans attendre l'index TTL", async () => {
    freezeTime();
    await call(GET, { as: "alex" });

    advanceTime(24 * 3_600_000);
    const res = await call(GET, { as: "alex" });

    expect(res.body.items.every((item: { instant: unknown }) => item.instant === null)).toBe(true);
  });

  it("montre le dernier Instant d'un compte", async () => {
    await db.story.create({
      data: { authorId: USERS.noah, art: "moon", text: "Nouveau", expiresAt: new Date(Date.now() + 3_600_000) },
    });

    const res = await call(GET, { as: "alex" });

    expect(res.body.items.find((item: { id: string }) => item.id === USERS.noah).instant).toMatchObject({ text: "Nouveau" });
  });
});
