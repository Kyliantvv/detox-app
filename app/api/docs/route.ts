// Swagger UI chargé depuis un CDN (version figée), sans dépendance npm : il lit GET /api/openapi.
const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

const PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Détox API · Swagger</title>
    <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({ url: "/api/openapi", dom_id: "#swagger-ui", persistAuthorization: true });
    </script>
  </body>
</html>`;

export function GET() {
  return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
}
