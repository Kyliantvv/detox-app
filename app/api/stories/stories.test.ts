import { describe, expect, it } from "vitest";
import { followingOf } from "@/lib/server/db";
import { advanceTime, call, freezeTime } from "@/test/api";
import { GET } from "./route";

describe("GET /api/stories", () => {
  it("liste les comptes suivis, ceux qui ont un Instant en premier", async () => {
    const res = await call(GET, { as: "alex" });

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(["lina", "karim", "ines", "noah"]);
    expect(res.body.items[1]).toEqual({
      id: "karim",
      username: "karim.zen",
      name: "Karim",
      instant: { art: "ring", text: "14 jours de série. Je ne sens plus mon pouce.", ago: "il y a 40 min" },
    });
    expect(res.body.items[3].instant).toBeNull();
  });

  it("fait disparaître les Instants après 24 h", async () => {
    freezeTime();
    await call(GET, { as: "alex" });

    advanceTime(24 * 3_600_000);
    const res = await call(GET, { as: "alex" });

    expect(res.body.items.every((item: { instant: unknown }) => item.instant === null)).toBe(true);
  });

  it("ignore les comptes suivis qui n'existent plus", async () => {
    followingOf("alex").add("supprime");

    const res = await call(GET, { as: "alex" });

    expect(res.body.items).toHaveLength(4);
  });
});
