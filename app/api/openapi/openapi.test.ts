import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { call } from "@/test/api";
import { buildSpec } from "@/scripts/openapi-spec";
import generated from "@/lib/openapi.generated.json";
import * as docs from "../docs/route";
import { GET } from "./route";

const refs = (value: unknown): string[] =>
  typeof value !== "object" || value === null
    ? []
    : Object.entries(value).flatMap(([key, child]) => (key === "$ref" ? [child as string] : refs(child)));

describe("GET /api/openapi", () => {
  it("décrit toutes les routes, publiquement", async () => {
    const res = await call(GET);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        "/api/auth/login",
        "/api/feed/flow",
        "/api/feed/reels",
        "/api/posts/{id}/likes",
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

  it("est à jour avec les blocs @openapi des routes (pnpm openapi)", () => {
    expect(JSON.parse(JSON.stringify(buildSpec()))).toEqual(generated);
  });

  it("documente chaque route.ts de app/api", () => {
    const documented = new Set(Object.keys(generated.paths));
    const routes = readdirSync("app/api", { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith("route.ts"))
      .filter((file) => !/^(docs|openapi)\/|\[\.\.\./.test(file))
      .map((file) => `/api/${dirname(file)}`.replace(/\[(\w+)\]/g, "{$1}"));
    expect(routes.filter((path) => !documented.has(path))).toEqual([]);
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
