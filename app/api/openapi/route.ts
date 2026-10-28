import { openApiSpec } from "@/lib/openapi";

// Description OpenAPI de l'API, publique comme /api/health.
export function GET() {
  return Response.json(openApiSpec);
}
