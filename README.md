# Détox

Faux réseau social volontairement addictif. **Parodie, projet scolaire** : on gagne des points en scrollant et on les dépense dans une boutique fictive. Aucun vrai achat, aucun vrai paiement, aucune vraie livraison.

Détox a la forme d'Instagram (fil, stories, reels, messages, recherche, profil), mais chaque geste rapporte des points, qu'on dépense dans une boutique d'objets addictifs et dans des compétences d'espionnage de ses amis. Le nom dit l'inverse du produit : c'est l'ironie.

- **Problème mis en scène** : les réseaux sociaux captent l'attention avec des récompenses aléatoires, des séries et du scroll infini. Détox pousse ces mécanismes à l'extrême pour les rendre visibles.
- **Cible** : les étudiants et le jury du cours, pour la démo.
- **Rendu** : jeudi 29 octobre 2026, groupe de 4.

## Stack

- **Front** : React + Vite, JavaScript, React Router
- **Back** : Node.js + Express (routes / contrôleurs / services / modèles)
- **Base** : MongoDB + Mongoose ; médias sur disque via Multer (`uploads/`)
- **Sécurité** : bcrypt, JWT signé (`JWT_SECRET` en variable d'environnement), middleware Bearer
- **Qualité** : ESLint, Vitest + Supertest, Swagger/OpenAPI
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/) (`feat:`, `fix:`, `test:`…), vérifiés par commitlint (hook `commit-msg` + CI)
- **Lancement** : monorepo `frontend/` + `backend/`, `docker compose up` (mongo, backend, frontend)

**Pourquoi Vitest plutôt que Jest**

- **Compatibilité ESM** : `files-sdk` (entre autres) est publié uniquement en ESM. Jest fonctionne mal avec l'ESM; Vitest fonctionne avec l'ESM nativement.
- **TypeScript sans configuration** : pas de Babel, `ts-jest` ni `ts-node`, et aucun fichier de config.
- **Même API que Jest** : `describe`, `it`, `expect` et les mêmes matchers, donc rien à réapprendre. Supertest fonctionne pareil.

## Lancer le projet

Prérequis : Node.js 22 et pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # puis renseigner les variables ci-dessous
pnpm dev
```

- App : http://localhost:3000

**Variables d'environnement**

| Variable | Rôle |
|---|---|
| `UPLOADTHING_TOKEN` | Clé d'API UploadThing (dashboard UploadThing → API Keys) |
| `FILES_API_SECRET` | Secret qui signe les envois de fichiers (`openssl rand -hex 32`) |

Le build passe sans ces variables, mais les envois de fichiers échouent.

**Scripts**

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Build de production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Génère les types des routes Next.js, puis lance `tsc` |
| `pnpm test` | Tests Vitest |

La CI lance `lint`, `typecheck`, `test` et `build` sur chaque PR, et vérifie les messages de commit avec commitlint.

**Envoi de fichiers**

Les fichiers passent par `/api/files` (`files-sdk`) et sont stockés sur UploadThing. Règles appliquées par le serveur :

- Images uniquement : AVIF, GIF, JPEG, PNG, WebP. Le SVG est refusé, car il peut contenir des scripts.
- 4 Mo maximum par fichier (la limite de Vercel est de 4,5 Mo par requête).
- Le serveur choisit le nom du fichier ; un client ne peut pas écraser un fichier existant.
- Pas encore d'authentification : n'importe qui peut envoyer une image et obtenir son URL publique.

## Contrat d'API

- Routes sous `/api` ; `GET /api/health` renvoie `{"status":"ok"}`.
- `POST /api/auth/register` (201) et `POST /api/auth/login` (200) renvoient `{"user":{"id","email","username"},"token"}`.
- Erreurs : `{"error":{"code","message"}}`.

  | Code | Statut |
  |---|---|
  | `INVALID_INPUT` | 400 |
  | `UNAUTHORIZED` | 401 |
  | `NOT_FOUND` | 404 |
  | `EMAIL_ALREADY_USED` | 409 |

- Identifiant public `id` (jamais `_id`) ; `ownerId` déduit du JWT ; listes en `{"items":[...]}`.
- `PATCH` partiel, champs inconnus refusés ; id mal formé → 400.

## Vocabulaire

| Terme | Sens dans l'app |
|---|---|
| Mon cercle | Les comptes suivis ; fil des amis |
| Flow | Fil infini ; chaque page lue rapporte des points |
| Instant | Story, visible 24 h |
| Bonne dose | Like |
| Sérénité | Jauge de calme, qui baisse quand on scrolle trop |
| L'Épicerie | La boutique d'objets addictifs |
| Clairvoyance | Les compétences d'espionnage d'un ami |

## Économie de points

Tout est calculé côté serveur : chaque gain est un `PointEvent`, chaque débit un `$inc` atomique avec condition de solde suffisant.

| Action | Gain |
|---|---|
| Une page de Flow lue | +10 |
| Une Bonne dose donnée | +2 |
| Une réaction (commentaire, republication) | +5 |
| Une connexion quotidienne | +25 |
| Bonus aléatoire | variable |
| Combo (actions enchaînées) | multiplicateur |

**L'Épicerie** : sachet de sucre (150), ticket à gratter (300), loot box (600), paquet de cigarettes (1000). Une commande crée une fausse livraison avec numéro de suivi inventé. Rien n'est livré.

**Clairvoyance** : 10 compétences pour espionner un ami (dernière connexion, solde, série, temps de scroll, derniers achats, visites de profil, plus gros gain, heures de pointe, cercle proche, dossier complet). Achat unique par cible, cible jamais notifiée, métadonnées seulement.

## Répartition

| Rôle | Responsabilités |
|---|---|
| 1. Comptes et sécurité | Auth, JWT, validation, erreurs normalisées, Swagger, tests d'auth |
| 2. Contenu et fil | Posts (CRUD), uploads, Flow, Mon cercle, likes, commentaires, abonnements, Instants |
| 3. Points et boutique | Points serveur, L'Épicerie, commandes, Clairvoyance, tirages |
| 4. Messages, design, qualité | Messages, recherche, profil, intégration des maquettes, README, Docker, tests de bout en bout |

## Avertissement

Projet scolaire parodique. Tout est fictif. Les marques réelles ne sont citées qu'en texte, sans logo.
