// Description OpenAPI 3.1 de l'API, servie par GET /api/openapi et affichée par Swagger UI sur /api/docs.
// Pour l'instant : L'Épicerie, les tirages et la Clairvoyance. Chaque domaine ajoute ses routes dans `paths`.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema: object) => ({ content: { "application/json": { schema } } });
const ok = (description: string, schema: object) => ({ description, ...jsonBody(schema) });
const error = (name: string) => ({ $ref: `#/components/responses/${name}` });

const errorResponse = (description: string, code: string) => ({
  description,
  ...jsonBody({ ...ref("Error"), example: { error: { code, message: "Message lisible" } } }),
});

const SKILL_IDS = [
  "derniere-connexion",
  "solde",
  "serie",
  "temps-scroll",
  "derniers-achats",
  "visites-profil",
  "plus-gros-gain",
  "heures-pointe",
  "cercle-proche",
  "dossier-complet",
];

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Détox API",
    version: "1.0.0",
    description:
      "Parodie de réseau social, projet scolaire : tout est fictif, aucun achat réel. Les montants de points sont toujours calculés par le serveur.",
  },
  servers: [{ url: "/" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "L'Épicerie", description: "Catalogue, achats et fausses commandes" },
    { name: "Tirages", description: "Ticket à gratter : le serveur tire les cases, le client ne fait que gratter" },
    { name: "Clairvoyance", description: "Compétences d'espionnage d'un ami ; la cible n'est jamais notifiée" },
  ],
  paths: {
    "/api/shop": {
      get: {
        tags: ["L'Épicerie"],
        summary: "Catalogue de L'Épicerie",
        security: [],
        responses: { 200: ok("Les 4 articles", { type: "object", properties: { items: { type: "array", items: ref("ShopItem") } } }) },
      },
    },
    "/api/orders": {
      get: {
        tags: ["L'Épicerie"],
        summary: "Mes commandes, de la plus récente à la plus ancienne",
        responses: {
          200: ok("Commandes du compte connecté", { type: "object", properties: { items: { type: "array", items: ref("Order") } } }),
          401: error("Unauthorized"),
        },
      },
      post: {
        tags: ["L'Épicerie"],
        summary: "Acheter un article",
        description: "Débite le prix, puis crée une fausse commande, un ticket à gratter ou ouvre une loot box selon l'article.",
        requestBody: {
          required: true,
          ...jsonBody({
            type: "object",
            required: ["itemId"],
            additionalProperties: false,
            properties: { itemId: { type: "string", enum: ["sucre", "ticket", "lootbox", "cigarettes"] } },
          }),
        },
        responses: {
          201: ok("Achat effectué", { allOf: [ref("Purchase"), ref("PointsResponse")] }),
          400: error("InvalidInput"),
          401: error("Unauthorized"),
          404: error("NotFound"),
          409: error("InsufficientPoints"),
        },
      },
    },
    "/api/orders/{id}": {
      get: {
        tags: ["L'Épicerie"],
        summary: "Détail d'une commande et son faux suivi",
        description: "Les étapes se valident avec le temps écoulé depuis l'achat ; la livraison n'arrive jamais. La commande d'un autre compte répond 404.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("La commande", { type: "object", properties: { order: ref("OrderDetail") } }),
          400: error("InvalidInput"),
          401: error("Unauthorized"),
          404: error("NotFound"),
        },
      },
    },
    "/api/dice": {
      post: {
        tags: ["Tirages"],
        summary: "Acheter un ticket à gratter",
        description: "Remplace le ticket en cours. Les cases sont tirées ici ; les cases non grattées ne sont jamais envoyées.",
        responses: {
          201: ok("Ticket acheté", { allOf: [ref("Purchase"), ref("PointsResponse")] }),
          401: error("Unauthorized"),
          409: error("InsufficientPoints"),
        },
      },
    },
    "/api/ticket": {
      get: {
        tags: ["Tirages"],
        summary: "Ticket en cours",
        responses: {
          200: ok("Le ticket, cases non grattées masquées", { type: "object", properties: { ticket: ref("TicketView") } }),
          401: error("Unauthorized"),
          404: error("NotFound"),
        },
      },
    },
    "/api/ticket/scratch": {
      post: {
        tags: ["Tirages"],
        summary: "Gratter une case",
        description: "Le gain est versé une seule fois, quand la dernière case est grattée.",
        requestBody: {
          required: true,
          ...jsonBody({
            type: "object",
            required: ["index"],
            additionalProperties: false,
            properties: { index: { type: "integer", minimum: 0, maximum: 5 } },
          }),
        },
        responses: {
          200: ok("Ticket mis à jour", {
            allOf: [{ type: "object", properties: { ticket: ref("TicketView") } }, ref("PointsResponse")],
          }),
          400: error("InvalidInput"),
          401: error("Unauthorized"),
          404: error("NotFound"),
        },
      },
    },
    "/api/skills": {
      get: {
        tags: ["Clairvoyance"],
        summary: "Compétences disponibles sur une cible",
        parameters: [{ name: "targetId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("Catalogue et informations déjà débloquées", {
            type: "object",
            properties: { items: { type: "array", items: ref("SkillView") }, intel: ref("Intel") },
          }),
          400: error("InvalidInput"),
          401: error("Unauthorized"),
          404: error("NotFound"),
          409: error("TargetShielded"),
        },
      },
    },
    "/api/skills/{skillId}": {
      post: {
        tags: ["Clairvoyance"],
        summary: "Acheter une compétence sur une cible",
        description: "Achat unique par cible : une compétence déjà possédée n'est pas débitée une seconde fois. « dossier-complet » débloque tout.",
        parameters: [{ name: "skillId", in: "path", required: true, schema: { type: "string", enum: SKILL_IDS } }],
        requestBody: {
          required: true,
          ...jsonBody({ type: "object", required: ["targetId"], additionalProperties: false, properties: { targetId: { type: "string" } } }),
        },
        responses: {
          200: ok("Compétences possédées et informations révélées", {
            type: "object",
            properties: {
              owned: { type: "array", items: { type: "string", enum: SKILL_IDS } },
              intel: ref("Intel"),
              points: { type: "integer" },
              events: { type: "array", items: ref("PointEvent") },
            },
          }),
          400: error("InvalidInput"),
          401: error("Unauthorized"),
          404: error("NotFound"),
          409: error("InsufficientPoints"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Token renvoyé par POST /api/auth/login" },
    },
    responses: {
      InvalidInput: errorResponse("Corps, champ ou identifiant invalide", "INVALID_INPUT"),
      Unauthorized: errorResponse("Token absent, invalide ou expiré", "UNAUTHORIZED"),
      NotFound: errorResponse("Objet absent ou appartenant à un autre compte", "NOT_FOUND"),
      InsufficientPoints: errorResponse("Solde insuffisant : rien n'est débité", "INSUFFICIENT_POINTS"),
      TargetShielded: errorResponse("Cible protégée par un bouclier", "TARGET_SHIELDED"),
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
        },
      },
      ShopItem: {
        type: "object",
        properties: {
          id: { type: "string", enum: ["sucre", "ticket", "lootbox", "cigarettes"] },
          name: { type: "string" },
          price: { type: "integer", description: "En points" },
          description: { type: "string" },
          kind: { type: "string", enum: ["order", "ticket", "lootbox"] },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          itemId: { type: "string" },
          itemName: { type: "string" },
          price: { type: "integer" },
          tracking: { type: "string", example: "DTX-123456-FR" },
          address: { type: "string", description: "Adresse fictive" },
          at: { type: "integer", description: "Date d'achat, en millisecondes" },
        },
      },
      TrackingStep: {
        type: "object",
        properties: {
          label: { type: "string" },
          at: { type: ["integer", "null"], description: "null pour la livraison, qui n'arrive jamais" },
          done: { type: "boolean" },
        },
      },
      OrderDetail: {
        allOf: [ref("Order"), { type: "object", properties: { steps: { type: "array", items: ref("TrackingStep") } } }],
      },
      TicketView: {
        type: "object",
        properties: {
          cells: { type: "array", items: { type: ["integer", "null"] }, description: "null tant que la case n'est pas grattée" },
          revealed: { type: "array", items: { type: "boolean" } },
          paidOut: { type: "boolean" },
          winnings: { type: ["integer", "null"] },
        },
      },
      Purchase: {
        oneOf: [
          { type: "object", properties: { kind: { const: "order" }, order: ref("Order") } },
          { type: "object", properties: { kind: { const: "ticket" }, ticket: ref("TicketView") } },
          { type: "object", properties: { kind: { const: "lootbox" }, prize: { type: "string" } } },
        ],
      },
      PointEvent: {
        type: "object",
        properties: { id: { type: "string" }, amount: { type: "integer" }, label: { type: "string" }, at: { type: "integer" } },
      },
      PointsResponse: {
        type: "object",
        properties: { points: { type: "integer", description: "Nouveau solde" }, gains: { type: "array", items: ref("PointEvent") } },
      },
      SkillView: {
        type: "object",
        properties: {
          id: { type: "string", enum: SKILL_IDS },
          name: { type: "string" },
          shows: { type: "string" },
          price: { type: "integer" },
          owned: { type: "boolean" },
        },
      },
      Intel: {
        type: "object",
        description: "Informations débloquées, par compétence (métadonnées seulement, jamais de contenu)",
        additionalProperties: { type: "string" },
      },
    },
  },
};
