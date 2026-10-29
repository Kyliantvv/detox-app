/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Système]
 *     summary: État du service
 *     security: []
 *     responses:
 *       '200': { description: Le service répond, content: { application/json: { schema: { type: object, properties: { status: { type: string, example: ok } } } } } }
 */
export function GET() {
  return Response.json({ status: "ok" });
}
