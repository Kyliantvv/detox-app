import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { ApiError, assertId, errorResponse, readBody, route, type ErrorCode } from "./http";

const jsonRequest = (body: string) => new Request("http://localhost/", { method: "POST", body });

describe("route", () => {
  const run = (handler: () => Response) => route(handler)({} as NextRequest, undefined);

  it("renvoie la réponse du handler", async () => {
    const response = await run(() => Response.json({ ok: true }, { status: 201 }));

    expect(response.status).toBe(201);
  });

  it("convertit une ApiError en erreur normalisée", async () => {
    const response = await run(() => {
      throw new ApiError("TARGET_SHIELDED", "Bouclier.");
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "TARGET_SHIELDED", message: "Bouclier." } });
  });

  it("masque les erreurs inattendues derrière une 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await run(() => {
      throw new Error("secret interne");
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL", message: "Erreur interne." } });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: "secret interne" }));
  });
});

describe("errorResponse", () => {
  it.each([
    ["INVALID_INPUT", 400],
    ["UNAUTHORIZED", 401],
    ["NOT_FOUND", 404],
    ["EMAIL_ALREADY_USED", 409],
    ["USERNAME_ALREADY_USED", 409],
    ["INSUFFICIENT_POINTS", 409],
    ["TARGET_SHIELDED", 409],
  ] satisfies [ErrorCode, number][])("%s → %i", (code, status) => {
    expect(errorResponse(code, "x").status).toBe(status);
  });
});

describe("assertId", () => {
  it.each(["c1", "lina.m", "f_12-3", "a".repeat(64)])("accepte %j", (id) => {
    expect(assertId(id)).toBe(id);
  });

  it.each(["", "a b", "../x", "a/b", "é", "a".repeat(65)])("refuse %j", (id) => {
    expect(() => assertId(id, "postId")).toThrow(new ApiError("INVALID_INPUT", "postId mal formé."));
  });
});

describe("readBody", () => {
  const spec = { text: "string", index: "number", note: "string?" } as const;

  it("renvoie le corps quand il respecte le schéma", async () => {
    await expect(readBody(jsonRequest('{"text":"a","index":1}'), spec)).resolves.toEqual({ text: "a", index: 1 });
  });

  it.each([
    ["un JSON invalide", "{", "Corps JSON invalide."],
    ["un corps vide", "", "Corps JSON invalide."],
    ["null", "null", "Le corps doit être un objet JSON."],
    ["un tableau", "[1]", "Le corps doit être un objet JSON."],
    ["une chaîne", '"texte"', "Le corps doit être un objet JSON."],
    ["des champs inconnus", '{"text":"a","index":1,"x":1,"y":2}', "Champ(s) inconnu(s) : x, y."],
    ["un champ requis absent", '{"text":"a"}', "Champ « index » : number attendu."],
    ["un champ requis à null", '{"text":null,"index":1}', "Champ « text » : string attendu."],
    ["un champ optionnel mal typé", '{"text":"a","index":1,"note":3}', "Champ « note » : string attendu."],
  ])("refuse %s", async (_, body, message) => {
    await expect(readBody(jsonRequest(body), spec)).rejects.toThrow(new ApiError("INVALID_INPUT", message));
  });
});
