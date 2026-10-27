import { describe, expect, it } from "vitest";
import { parisDay } from "../lib/db/time";
import { createRng, fakePosts, fakeSeed, fakeUsers, SEED_EMAIL_DOMAIN } from "./seed-data";

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

  describe("fakeSeed", () => {
    const seed = fakeSeed({ users: 50, posts: 200, followsPerUser: 10, likesPerPost: 8 }, createRng(42), now);
    const unique = (keys: string[]) => new Set(keys).size === keys.length;

    it("crée des ids uniques au format ObjectId", () => {
      const ids = [...seed.users, ...seed.posts, ...seed.likes].map((d) => d.id);
      expect(unique(ids)).toBe(true);
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{24}$/);
    });

    it("crée des abonnements uniques, sans se suivre soi-même", () => {
      expect(seed.follows.length).toBeGreaterThan(0);
      expect(unique(seed.follows.map((f) => `${f.followerId}-${f.followingId}`))).toBe(true);
      for (const f of seed.follows) expect(f.followerId).not.toBe(f.followingId);
    });

    it("crée des likes uniques, jamais de l'auteur, et des compteurs justes", () => {
      expect(unique(seed.likes.map((l) => `${l.userId}-${l.postId}`))).toBe(true);
      for (const post of seed.posts) {
        const likes = seed.likes.filter((l) => l.postId === post.id);
        expect(post.likesCount).toBe(likes.length);
        for (const l of likes) {
          expect(l.userId).not.toBe(post.authorId);
          expect(l.createdAt.getTime()).toBeGreaterThanOrEqual(post.createdAt.getTime());
        }
      }
    });

    it("donne des soldes égaux à la somme du journal de points", () => {
      for (const user of seed.users) {
        const events = seed.pointEvents.filter((e) => e.userId === user.id);
        const sum = events.reduce((s, e) => s + e.amount, 0);
        expect(user.points).toBe(sum);
        expect(user.totalEarned).toBe(sum);
        expect(events.filter((e) => e.type === "like")).toHaveLength(seed.likes.filter((l) => l.userId === user.id).length);
        // Mêmes règles que les index uniques partiels de point_events.
        expect(unique(events.filter((e) => e.type === "daily_login").map((e) => e.day))).toBe(true);
        const pages = events.filter((e) => e.type === "flow_page").map((e) => String(e.flowPage));
        expect(unique(pages)).toBe(true);
        for (const e of events) {
          const at = new Date(e.createdAt!);
          expect(e.day).toBe(parisDay(at));
          expect(at.getTime()).toBeLessThanOrEqual(now.getTime());
          expect(at.getTime()).toBeGreaterThanOrEqual(user.createdAt.getTime());
        }
      }
      expect(seed.users.some((u) => (u.points ?? 0) > 0)).toBe(true);
    });
  });
});
