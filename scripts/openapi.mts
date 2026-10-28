// Écrit lib/openapi.generated.json, relu par GET /api/openapi : la prod ne lit pas les sources des routes.
import { writeFileSync } from "node:fs";
import { buildSpec, OPENAPI_FILE } from "./openapi-spec";

const spec = buildSpec();
writeFileSync(OPENAPI_FILE, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`${Object.keys(spec.paths ?? {}).length} chemins écrits dans ${OPENAPI_FILE}`);
