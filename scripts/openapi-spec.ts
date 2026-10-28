// Assemble la description OpenAPI : base de lib/openapi.ts + blocs `@openapi` des app/api/**/route.ts.
import { createSwaggerSpec } from "next-swagger-doc";
import { openApiDefinition } from "../lib/openapi";

export const OPENAPI_FILE = "lib/openapi.generated.json";

export const buildSpec = () => createSwaggerSpec({ apiFolder: "app/api", definition: openApiDefinition as never });
