import { describe, expect, it } from "vitest";
import { advanceTime, apiError, call, freezeTime } from "@/test/api";
import { POST } from "../route";
import { GET } from "./route";

const buySugar = async (as: string) => (await call(POST, { as, body: { itemId: "sucre" } })).body.order;
const getOrder = (id: string, as = "alex") => call(GET, { as, params: { id } });
const doneLabels = (steps: { label: string; done: boolean }[]) => steps.filter((s) => s.done).map((s) => s.label);

describe("GET /api/orders/[id]", () => {
  it("renvoie la commande avec son faux suivi", async () => {
    const order = await buySugar("alex");

    const res = await getOrder(order.id);

    expect(res.status).toBe(200);
    expect(res.body.order).toEqual({ ...order, steps: expect.any(Array) });
    expect(res.body.order.steps.map((s: { label: string }) => s.label)).toEqual([
      "Commande validée",
      "Colis préparé",
      "Remis au transporteur",
      "En transit",
      "Livré",
    ]);
  });

  it("valide les étapes avec le temps, sans jamais livrer", async () => {
    freezeTime();
    const order = await buySugar("alex");

    expect(doneLabels((await getOrder(order.id)).body.order.steps)).toEqual(["Commande validée"]);

    advanceTime(10 * 60_000);
    expect(doneLabels((await getOrder(order.id)).body.order.steps)).toEqual([
      "Commande validée",
      "Colis préparé",
      "Remis au transporteur",
    ]);

    advanceTime(365 * 24 * 3_600_000);
    const steps = (await getOrder(order.id)).body.order.steps;
    expect(steps.at(-1)).toEqual({ label: "Livré", at: null, done: false });
  });

  it("répond 404 sur la commande d'un autre compte", async () => {
    const order = await buySugar("alex");

    expect(await getOrder(order.id, "lina")).toMatchObject({ status: 404, body: apiError("NOT_FOUND") });
  });

  it("répond 404 pour une commande inconnue", async () => {
    expect(await getOrder("inconnue")).toMatchObject({ status: 404, body: apiError("NOT_FOUND") });
  });

  it("répond 400 pour un id mal formé", async () => {
    expect(await getOrder("pas un id!")).toMatchObject({ status: 400, body: apiError("INVALID_INPUT") });
  });

  it("répond 401 sans token", async () => {
    const res = await call(GET, { params: { id: "abc" } });

    expect(res).toMatchObject({ status: 401, body: apiError("UNAUTHORIZED") });
  });
});
