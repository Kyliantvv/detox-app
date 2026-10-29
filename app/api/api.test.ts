// Contrat commun à toutes les routes : authentification Bearer et format des erreurs.
import { describe, expect, it } from "vitest";
import { signToken } from "@/lib/server/auth";
import { apiError, call, type CallOptions, type Handler } from "@/test/api";
import { POSTS, USERS } from "@/test/db";
import * as conversations from "./conversations/route";
import * as messages from "./conversations/[id]/messages/route";
import * as dice from "./dice/route";
import * as circle from "./feed/circle/route";
import * as flow from "./feed/flow/route";
import * as follows from "./follows/route";
import * as unfollow from "./follows/[targetId]/route";
import * as health from "./health/route";
import * as me from "./me/route";
import * as orders from "./orders/route";
import * as posts from "./posts/route";
import * as comments from "./posts/[id]/comments/route";
import * as likes from "./posts/[id]/likes/route";
import * as saves from "./posts/[id]/saves/route";
import * as shop from "./shop/route";
import * as skills from "./skills/route";
import * as skill from "./skills/[skillId]/route";
import * as stories from "./stories/route";
import * as ticket from "./ticket/route";
import * as scratch from "./ticket/scratch/route";
import * as users from "./users/route";
import * as user from "./users/[username]/route";


const post = { id: POSTS.c1 };
// /api/media accepte aussi le cookie NextAuth : testée à part (app/api/media).
const PROTECTED: [string, Handler<never>, CallOptions?][] = [
  ["GET /api/me", me.GET],
  ["PATCH /api/me", me.PATCH, { method: "PATCH" }],
  ["GET /api/feed/circle", circle.GET],
  ["GET /api/feed/flow", flow.GET],
  ["GET /api/posts", posts.GET],
  ["POST /api/posts", posts.POST, { method: "POST" }],
  ["GET /api/posts/[id]/comments", comments.GET, { params: post }],
  ["POST /api/posts/[id]/comments", comments.POST, { method: "POST", params: post }],
  ["POST /api/posts/[id]/likes", likes.POST, { method: "POST", params: post }],
  ["DELETE /api/posts/[id]/likes", likes.DELETE, { method: "DELETE", params: post }],
  ["POST /api/posts/[id]/saves", saves.POST, { method: "POST", params: post }],
  ["DELETE /api/posts/[id]/saves", saves.DELETE, { method: "DELETE", params: post }],
  ["GET /api/follows", follows.GET],
  ["POST /api/follows", follows.POST, { method: "POST" }],
  ["DELETE /api/follows/[targetId]", unfollow.DELETE, { method: "DELETE", params: { targetId: USERS.lina } }],
  ["GET /api/users", users.GET],
  ["GET /api/users/[username]", user.GET, { params: { username: "lina.m" } }],
  ["GET /api/conversations", conversations.GET],
  ["GET /api/conversations/[id]/messages", messages.GET, { params: { id: USERS.lina } }],
  ["POST /api/conversations/[id]/messages", messages.POST, { method: "POST", params: { id: USERS.lina } }],
  ["GET /api/orders", orders.GET],
  ["POST /api/orders", orders.POST, { method: "POST" }],
  ["POST /api/dice", dice.POST, { method: "POST" }],
  ["GET /api/ticket", ticket.GET],
  ["POST /api/ticket/scratch", scratch.POST, { method: "POST" }],
  ["GET /api/skills", skills.GET, { query: { targetId: USERS.lina } }],
  ["POST /api/skills/[skillId]", skill.POST, { method: "POST", params: { skillId: "solde" } }],
  ["GET /api/stories", stories.GET],
];

describe("routes protégées", () => {
  const [header, payload] = signToken(USERS.alex).split(".");

  it.each([
    ["sans en-tête Authorization", {}],
    ["avec un autre schéma que Bearer", { headers: { authorization: `Basic ${signToken(USERS.alex)}` } }],
    ["avec un token mal formé", { token: "pas-un-jwt" }],
    ["avec une signature falsifiée", { token: `${header}.${payload}.signature` }],
    ["pour un compte qui n'existe pas", { as: "0".repeat(24) }],
  ] satisfies [string, CallOptions][])("refusent une requête %s", async (_, auth) => {
    const res = await call(me.GET, auth);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(apiError("UNAUTHORIZED", "Token manquant ou invalide."));
  });

  it.each(PROTECTED)("%s exige un Bearer", async (_, handler, options) => {
    const res = await call(handler, options);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(apiError("UNAUTHORIZED"));
  });
});

describe("routes publiques", () => {
  it("GET /api/health répond sans authentification", async () => {
    const res = await call(health.GET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /api/shop renvoie le catalogue de L'Épicerie", async () => {
    const res = await call(shop.GET);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toEqual({
      id: "sucre",
      name: "Sachet de sucre",
      price: 150,
      description: "Un petit coup de sucre, livré à ta porte.",
      kind: "order",
    });
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(["sucre", "ticket", "lootbox", "cigarettes"]);
  });
});
