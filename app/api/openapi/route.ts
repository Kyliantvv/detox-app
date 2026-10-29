import spec from "@/lib/openapi.generated.json";

// Description OpenAPI de l'API, publique comme /api/health.
// Fichier produit par `pnpm openapi` (next-swagger-doc) à partir des blocs @openapi des routes.
export function GET() {
  return Response.json(spec);
}
