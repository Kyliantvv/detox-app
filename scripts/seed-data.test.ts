import { describe, expect, it } from "vitest";
import { createRng, fakePosts, fakeUsers, SEED_EMAIL_DOMAIN } from "./seed-data";

describe("seed-data", () => {
  const now = new Date("2026-10-27T12:00:00Z");

  it("donne les mêmes données pour une même graine", () => {
    expect(fakeUsers(20, createRng(1), now)).toEqual(fakeUsers(20, createRng(1), now));
    expect(fakeUsers(20, createRng(1), now)).not.toEqual(fakeUsers(20, createRng(2), now));
  });

  it("crée des utilisateurs valides et uniques", () => {
    const users = fakeUsers(1000, createRng(42), now);
    expect(new Set(users.map((u) => u.username)).size).toBe(1000);
    for (const u of users) {
      expect(u.username).toMatch(/^[a-z]+\.[a-z]+\d+$/);
      expect(u.username.length).toBeLessThanOrEqual(30);
      expect(u.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)).toBe(true);
    }
  });

  it("répartit les posts entre les auteurs, dans le passé", () => {
    const posts = fakePosts(500, ["a", "b", "c"], createRng(42), now);
    expect(posts).toHaveLength(500);
    expect(new Set(posts.map((p) => p.authorId))).toEqual(new Set(["a", "b", "c"]));
    for (const p of posts) {
      expect(new Date(p.createdAt!).getTime()).toBeLessThanOrEqual(now.getTime());
      expect(p.mediaMime).toBe(p.type === "reel" ? "video/mp4" : "image/jpeg");
    }
  });

  it("refuse des posts sans auteur", () => {
    expect(() => fakePosts(1, [], createRng(1))).toThrow();
  });
});
