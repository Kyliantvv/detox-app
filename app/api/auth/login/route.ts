import { loginWithPassword } from "@/lib/server/accounts";
import { json, readBody, route } from "@/lib/server/http";

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Compte]
 *     summary: Se connecter
 *     description: Renvoie le JWT à passer en Bearer sur les autres routes. Ouvre aussi la série du jour.
 *     security: []
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, additionalProperties: false, required: [email, password], properties: { email: { type: string, format: email }, password: { type: string } } } } } }
 *     responses:
 *       '200': { description: Connexion réussie, content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
export const POST = route(async (request) => {
  const { email, password } = await readBody(request, { email: "string", password: "string" });
  return json(await loginWithPassword(email, password));
});
