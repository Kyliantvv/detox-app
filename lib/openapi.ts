// Base de la description OpenAPI 3.1 : infos, tags, réponses et schémas partagés.
// Les chemins ne sont pas ici : chaque `app/api/**/route.ts` porte son propre bloc `@openapi` (YAML dans un
// commentaire JSDoc), et `pnpm openapi` (next-swagger-doc) assemble le tout dans lib/openapi.generated.json,
// servi par GET /api/openapi et affiché par Swagger UI sur /api/docs.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema: object) => ({ content: { "application/json": { schema } } });

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

export const openApiDefinition = {
  openapi: "3.1.0",
  info: {
    title: "Détox API",
    version: "1.0.0",
    description:
      "API de Détox, le réseau social qui récompense chaque geste. Les montants de points sont toujours calculés par le serveur.",
  },
  servers: [{ url: "/" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Compte", description: "Inscription, connexion et profil du compte connecté" },
    { name: "Comptes", description: "Recherche et profils publics" },
    { name: "Abonnements", description: "Suivre et ne plus suivre un compte" },
    { name: "Posts", description: "Publications, Bonnes doses, enregistrements, commentaires et médias" },
    { name: "Fil", description: "Cercle, Flow et Reels recommandés, Instants" },
    { name: "Messages", description: "Conversations et messages" },
    { name: "L'Épicerie", description: "Catalogue, achats et commandes" },
    { name: "Tirages", description: "Ticket à gratter : le serveur tire les cases, le client ne fait que gratter" },
    { name: "Clairvoyance", description: "Compétences d'espionnage d'un ami ; la cible n'est jamais notifiée" },
    { name: "Fichiers", description: "Téléversement d'images (files-sdk)" },
    { name: "Système", description: "Santé du service" },
  ],
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
      AuthUser: {
        type: "object",
        properties: { id: { type: "string" }, email: { type: "string" }, username: { type: "string" } },
      },
      AuthResponse: {
        allOf: [
          { type: "object", properties: { user: ref("AuthUser"), token: { type: "string", description: "JWT à envoyer en Bearer" } } },
          ref("PointsResponse"),
        ],
      },
      PostAuthor: {
        type: "object",
        properties: { id: { type: "string" }, username: { type: "string" }, name: { type: "string" } },
      },
      PublicUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          name: { type: "string" },
          bio: { type: "string" },
          status: { type: "string", description: "Calculé depuis la dernière activité" },
          level: { type: "integer" },
          hasInstant: { type: "boolean" },
          shielded: { type: "boolean" },
          followers: { type: "integer" },
          following: { type: "integer" },
          followedByMe: { type: "boolean" },
        },
      },
      Me: { allOf: [ref("PublicUser"), { type: "object", properties: { email: { type: "string" } } }] },
      Stats: {
        type: "object",
        properties: {
          points: { type: "integer" },
          totalEarned: { type: "integer" },
          totalSpent: { type: "integer" },
          bestGain: { type: "integer" },
          earnedToday: { type: "integer" },
          streak: { type: "integer" },
          serenity: { type: "integer" },
          level: { type: "integer" },
          flowPagesRead: { type: "integer" },
          dosesGiven: { type: "integer" },
          orders: { type: "integer" },
          friendsSpied: { type: "integer" },
          timeSpentMs: { type: "integer" },
          events: { type: "array", items: ref("PointEvent") },
        },
      },
      Comment: { type: "object", properties: { author: { type: "string", description: "Nom d'utilisateur" }, text: { type: "string" } } },
      PostView: {
        type: "object",
        properties: {
          id: { type: "string" },
          authorId: { type: "string" },
          author: { oneOf: [ref("PostAuthor"), { type: "null" }] },
          location: { type: "string" },
          ago: { type: "string" },
          art: { type: "string", description: "Visuel de repli quand il n'y a pas de média" },
          caption: { type: "string" },
          doses: { type: "integer", description: "Bonnes doses" },
          comments: { type: "array", items: ref("Comment") },
          isReel: { type: "boolean" },
          imageUrl: { type: "string" },
          videoUrl: { type: "string" },
          dosedByMe: { type: "boolean" },
          savedByMe: { type: "boolean" },
          reason: { type: "string", description: "Flow et Reels : pourquoi l'algorithme de recommandation a choisi ce post" },
        },
      },
      ExploreTile: {
        type: "object",
        properties: { id: { type: "string" }, art: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
      },
      StoryItem: {
        allOf: [
          ref("PostAuthor"),
          {
            type: "object",
            properties: {
              instant: {
                oneOf: [
                  { type: "object", properties: { art: { type: "string" }, text: { type: "string" }, ago: { type: "string" } } },
                  { type: "null" },
                ],
              },
            },
          },
        ],
      },
      ConversationItem: {
        type: "object",
        properties: {
          id: { type: "string", description: "Id de l'autre compte" },
          user: ref("PostAuthor"),
          preview: { type: "string" },
          fromMe: { type: "boolean" },
          ago: { type: "string" },
          at: { type: "integer" },
          unread: { type: "boolean" },
        },
      },
      ChatMessage: {
        type: "object",
        properties: {
          id: { type: "string" },
          from: { type: "string", enum: ["me", "them"] },
          text: { type: "string" },
          media: {
            type: "array",
            description: "Photos et vidéos, ou message vocal (audio/*) ; absent sans pièce jointe",
            items: { type: "object", properties: { url: { type: "string" }, mime: { type: "string" } } },
          },
          at: { type: "integer" },
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
          address: { type: "string", description: "Adresse de livraison" },
          at: { type: "integer", description: "Date d'achat, en millisecondes" },
        },
      },
      TrackingStep: {
        type: "object",
        properties: {
          label: { type: "string" },
          at: { type: ["integer", "null"], description: "null tant que la livraison n'a pas de date" },
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
