import { describe, expect, it } from "vitest";
import { call } from "@/test/api";
import * as docs from "../docs/route";
import { GET } from "./route";

const refs = (value: unknown): string[] =>
  typeof value !== "object" || value === null
    ? []
    : Object.entries(value).flatMap(([key, child]) => (key === "$ref" ? [child as string] : refs(child)));

describe("GET /api/openapi", () => {
  it("décrit toutes les routes de L'Épicerie, publiquement", async () => {
    const res = await call(GET);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        "/api/shop",
        "/api/orders",
        "/api/orders/{id}",
        "/api/dice",
        "/api/ticket",
        "/api/ticket/scratch",
        "/api/skills",
        "/api/skills/{skillId}",
      ]),
    );
  });

  it("ne référence que des schémas et réponses définis", async () => {
    const spec = (await call(GET)).body;
    const missing = refs(spec).filter((target) => {
      const [, , section, name] = target.split("/");
      return !spec.components[section]?.[name];
    });

    expect(missing).toEqual([]);
  });
});

describe("GET /api/docs", () => {
  it("sert Swagger UI branché sur /api/openapi", async () => {
    const res = await call(docs.GET);

    expect(res.status).toBe(200);
    expect(res.response.headers.get("content-type")).toContain("text/html");
    expect(await res.response.text()).toContain('url: "/api/openapi"');
  });
});
