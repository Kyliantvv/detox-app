import { registerAccount } from "@/lib/server/accounts";
import { json, readBody, route } from "@/lib/server/http";

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Compte]
 *     summary: Créer un compte
 *     security: []
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, additionalProperties: false, required: [email, username, password], properties: { email: { type: string, format: email }, username: { type: string, description: '3 à 30 caractères : lettres, chiffres, points ou _' }, password: { type: string, minLength: 8 } } } } } }
 *     responses:
 *       '201': { description: Compte créé et connecté, content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '409': { description: E-mail ou nom d'utilisateur déjà pris (EMAIL_ALREADY_USED, USERNAME_ALREADY_USED), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
export const POST = route(async (request) => {
  const body = await readBody(request, { email: "string", username: "string", password: "string" });
  return json(await registerAccount(body), 201);
});
