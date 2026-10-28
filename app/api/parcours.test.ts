// Parcours complet d'un nouveau compte, route après route, comme le ferait le front.
import { expect, it, vi } from "vitest";
import { POINTS } from "@/lib/game";
import { db } from "@/lib/db";
import { call, freezeTime } from "@/test/api";
import { POSTS, USERS } from "@/test/db";
import * as register from "./auth/register/route";
import * as dice from "./dice/route";
import * as flow from "./feed/flow/route";
import * as me from "./me/route";
import * as likes from "./posts/[id]/likes/route";
import * as skill from "./skills/[skillId]/route";
import * as scratch from "./ticket/scratch/route";

it("inscription → Flow → Bonne dose → ticket → Clairvoyance, avec un solde toujours cohérent", async () => {
  // Horloge figée (le combo dépend du temps écoulé) et pas de bonus aléatoire dans le Flow.
  freezeTime();
  vi.spyOn(Math, "random").mockReturnValue(0.99);

  const { body: session } = await call(register.POST, {
    body: { email: "zoe@example.com", username: "zoe", password: "secret1" },
  });
  const token = session.token as string;
  let points = POINTS.welcome + POINTS.dailyLogin;
  expect(session.points).toBe(points);

  for (const page of ["0", "1", "2", "3"]) {
    const res = await call(flow.GET, { token, query: { page } });
    points = res.body.points;
  }
  // 4 pages, puis un coffre à la 4e.
  expect(points).toBe(525 + 4 * POINTS.flowPage + POINTS.chest);

  // 5e action enchaînée : la dose passe en combo ×1,5.
  const like = await call(likes.POST, { token, params: { id: POSTS.f2 } });
  expect(like.body.gains).toEqual([expect.objectContaining({ amount: 3, label: "Bonne dose donnée · combo ×1.5" })]);
  expect(like.body.points).toBe(points + 3);
  points = like.body.points;

  const ticket = await call(dice.POST, { token, method: "POST" });
  expect(ticket.body.points).toBe(points - 300);
  points = ticket.body.points;
  // Ticket gagnant posé à la main, le tirage étant aléatoire.
  await db.draw.updateMany({
    where: { userId: session.user.id, kind: "scratch" },
    data: { cells: [200, 200, 200, 0, 50, 100].map((value) => ({ value, revealed: false })), payout: 200 },
  });
  for (let index = 0; index < 6; index++) points = (await call(scratch.POST, { token, body: { index } })).body.points;
  expect(points).toBe(525 + 40 + 50 + 3 - 300 + 200);

  const spy = await call(skill.POST, { token, params: { skillId: "serie" }, body: { targetId: USERS.karim } });
  expect(spy.body).toMatchObject({ intel: { serie: "14 jours" }, points: points - 150 });
  points = spy.body.points;

  const { stats } = (await call(me.GET, { token })).body;
  expect(stats).toMatchObject({
    points,
    totalEarned: 525 + 40 + 50 + 3 + 200,
    totalSpent: 300 + 150,
    flowPagesRead: 4,
    dosesGiven: 1,
    friendsSpied: 1,
    serenity: 100 - 4 * 3 - 1,
  });
  // Chaque mouvement de points laisse une trace : le solde est la somme de l'historique.
  expect(stats.events.reduce((sum: number, event: { amount: number }) => sum + event.amount, 0)).toBe(stats.points);
});
