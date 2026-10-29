# Détox

Le réseau social qui récompense chaque geste. On gagne des points en scrollant, en partageant et en réagissant, puis on les dépense dans L'Épicerie et dans des compétences de Clairvoyance. Les achats se font uniquement en points Détox : aucun paiement en argent réel.

Détox réunit fil, stories, reels, messages, recherche et profil, et fait de chaque geste une récompense : des points à dépenser dans une boutique d'objets exclusifs et dans des compétences pour suivre l'activité de ses amis.

- **Proposition de valeur** : récompenses variables, séries de connexion, combos et scroll infini, pour que chaque session compte.
- **Cible** : les étudiants et les jeunes actifs, très présents sur les réseaux sociaux.
- **Bilan** : la page Bilan rend visible le temps passé et la Sérénité, pour garder la main sur son usage.

## Stack

- **App** : Next.js 16 (App Router), React, TypeScript ; l'API vit dans `app/api/`
- **Médias** : UploadThing via `files-sdk` (route `/api/files`)
- **Base** : MongoDB Atlas + Prisma 6 (`prisma/schema.prisma`, `lib/db/`) ; MongoDB en Docker pour le dev et les tests (`compose.yaml`)
- **Sécurité** : scrypt, JWT signé (`JWT_SECRET` en variable d'environnement), middleware Bearer
- **Qualité** : ESLint, Vitest + Supertest ; description OpenAPI sur `/api/openapi`, Swagger UI sur `/api/docs`
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/) (`feat:`, `fix:`, `test:`…), vérifiés par commitlint (hook `commit-msg` + CI)
- **Lancement** : une seule app Next.js, déployée sur Vercel ; en local, voir ci-dessous

### Front

| Couche | Outil |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5.9 |
| Rendu | `cacheComponents` et `partialPrefetching` activés (`next.config.ts`) : les données d'exécution (`params`, `usePathname`) sont lues dans un `<Suspense>` |
| Style | Tailwind CSS 4 ; couleurs du thème dans `@theme` et classes réutilisables (`btn-sun`, `card`, `pill`, `input`) en `@utility`, dans `app/globals.css` |
| Polices | `next/font/google` : Inter (texte), Space Grotesk (titres), Press Start 2P (compteur de points) |
| Icônes et visuels | SVG maison (`components/icons.tsx`, `components/artwork.tsx`), sans bibliothèque |
| Appels à l'API | `lib/api-client.ts` : `fetch` avec le JWT en `Authorization: Bearer`, erreurs `{"error":{"code","message"}}` converties en `ApiClientError`, déconnexion sur 401 |
| Cache | SWR : la clé est le chemin de l'API (`mutate("/api/me")` rafraîchit le solde partout) ; `refreshInterval` pour le polling des messages |
| État | `useState` et SWR, sans store global ; mises à jour optimistes avec retour arrière en cas d'erreur (Bonne dose) |
| Session | NextAuth v5 (`SessionProvider`, `useSession`) ; `proxy.ts` protège les pages, `AppShell` gère la session qui expire en cours d'usage |
| Médias | `files-sdk/client` pour l'envoi vers UploadThing ; affichage en `<img>` et `<video autoPlay muted loop playsInline>` |
| Accessibilité | libellés visibles sur les champs, `aria-label` sur les boutons à icône, onglets en `role="tab"`, focus visible, animations coupées avec `prefers-reduced-motion` |

Organisation :

```
app/
  (auth)/             connexion, inscription (sans barre de navigation)
  (app)/              écrans connectés, avec AppShell et la barre du bas
    page.tsx          accueil : Instants, coffre, Mon cercle et Flow infini
    reels/            reels plein écran
    messages/[id]/    conversation (polling)
    recherche/        comptes et mosaïque d'exploration
    p/[id]/           détail d'un post
    u/[username]/     profil public
    profil/           mon profil
    publier/          envoi d'une photo ou d'un reel
    epicerie/         objets, clairvoyance/, jeux/ (ticket à gratter), commandes/
    bilan/            temps passé, Sérénité, points
components/           AppShell, BottomNav, TopBar, PostCard, Instants, ProfileView, Dialog…
lib/api-client.ts     accès à l'API depuis le front
```

**Pourquoi Vitest plutôt que Jest**

- **Compatibilité ESM** : `files-sdk` (entre autres) est publié uniquement en ESM. Jest fonctionne mal avec l'ESM; Vitest fonctionne avec l'ESM nativement.
- **TypeScript sans configuration** : pas de Babel, `ts-jest` ni `ts-node`, et aucun fichier de config.
- **Même API que Jest** : `describe`, `it`, `expect` et les mêmes matchers, donc rien à réapprendre. Supertest fonctionne pareil.

## Lancer le projet

Prérequis : Node.js 22 et pnpm 10.

```bash
pnpm install
cp .env.example .env   # puis renseigner les variables ci-dessous
pnpm dev
```

- App : http://localhost:3000

**Variables d'environnement**

| Variable | Rôle |
|---|---|
| `UPLOADTHING_TOKEN` | Clé d'API UploadThing (dashboard UploadThing → API Keys) |
| `FILES_API_SECRET` | Secret qui signe les envois de fichiers (`openssl rand -hex 32`) |

Le build passe sans ces variables. En production, `/api/files` renvoie une erreur 500 tant que `FILES_API_SECRET` manque : sans lui, chaque instance signerait les envois avec son propre secret et les envois échoueraient au hasard.

**Scripts**

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Build de production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Génère les types des routes Next.js, puis lance `tsc` |
| `pnpm test` | Tests Vitest |
| `pnpm db:indexes` | Crée les collections et index MongoDB (voir [docs/db](docs/db/README.md)) |
| `pnpm db:seed` | Remplit L'Épicerie et crée des comptes de démo avec abonnements, likes et soldes (`--users 100 --posts 500 --follows 20 --likes 10` par défaut) |

La CI lance `lint`, `typecheck`, `test` et `build` sur chaque PR, et vérifie les messages de commit avec commitlint.

**Envoi de fichiers**

Les fichiers passent par `/api/files` (`files-sdk`) et sont stockés sur UploadThing. Règles appliquées par le serveur :

- Connexion exigée : Bearer de l'API, comme les autres routes.
- Images (AVIF, GIF, JPEG, PNG, WebP) ou vidéos (MP4, WebM). Le serveur vérifie le type déclaré et les premiers octets du fichier. Le SVG est refusé, car il peut contenir des scripts.
- 4 Mo maximum par fichier (la limite de Vercel est de 4,5 Mo par requête).
- Le serveur choisit le nom du fichier ; un client ne peut pas écraser un fichier existant.
- Pour publier, le front envoie d'abord le fichier, puis passe sa clé à `POST /api/posts`. Une clé ne sert qu'à un post, et seulement à son auteur. Le média est ensuite servi par le CDN UploadThing.

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
  | `USERNAME_ALREADY_USED` | 409 |
  | `INSUFFICIENT_POINTS` | 409 |
  | `TARGET_SHIELDED` | 409 |

- Identifiant public `id` (jamais `_id`) ; `ownerId` déduit du JWT ; listes en `{"items":[...]}`.
- `PATCH` partiel, champs inconnus refusés ; id mal formé → 400.
- Les actions qui rapportent des points renvoient aussi `points` (nouveau solde) et `gains` (`PointEvent[]`).

### Implémentation actuelle (Route Handlers Next.js)

L'API tourne dans `app/api/**/route.ts`, au-dessus de MongoDB via Prisma (`lib/db`, voir [docs/db/README.md](docs/db/README.md)) ; `lib/server` porte la logique métier et met les documents au format du contrat. Le front ne contient aucune donnée : tout passe par l'API (`lib/api-client.ts`, cache SWR).

**Authentification** : NextAuth v5 (`auth.ts`), provider Credentials branché sur la base, session JWT dans un cookie httpOnly chiffré. La session porte aussi le JWT de l'API (`accessToken`), que le front envoie en `Authorization: Bearer`. `proxy.ts` renvoie toute page vers `/connexion` sans session, et `/connexion` vers `/` avec une session. Les médias publiés sont servis par le CDN UploadThing.

Variables (voir `.env.example`, à copier en `.env.local`) : `JWT_SECRET` et `AUTH_SECRET` (obligatoires en production), `AUTH_TRUST_HOST=true` hors Vercel. `MONGODB_URI` vise la base ; `pnpm db:seed` crée la boutique et les comptes de démonstration : `alex@detox.test`, `lina@detox.test`, `karim@detox.test`… mot de passe `demo1234`.

| Domaine | Routes (toutes sous `/api`, Bearer requis sauf `health`, `auth/*`, `shop`) |
|---|---|
| Comptes | `POST auth/register`, `POST auth/login`, `GET/PATCH me` |
| Fil | `GET feed/circle`, `GET feed/flow?page=N`, `GET stories` |
| Posts | `GET posts?author=&type=reel\|post&saved=1&explore=1`, `POST files` (envoi du média), `POST posts` (`mediaKey` + `caption`), `POST/DELETE posts/:id/likes`, `GET/POST posts/:id/comments`, `POST/DELETE posts/:id/saves` |
| Comptes suivis | `GET users?q=`, `GET users/:username`, `GET/POST follows`, `DELETE follows/:targetId` |
| L'Épicerie | `GET shop`, `GET/POST orders`, `POST dice`, `GET ticket`, `POST ticket/scratch` (cases non grattées jamais envoyées) |
| Clairvoyance | `GET skills?targetId=`, `POST skills/:skillId` |
| Messages | `GET conversations`, `GET/POST conversations/:id/messages` (en polling) |

## Base de données

Mise en route (Docker ou Atlas), collections et règles d'usage : [docs/db/README.md](docs/db/README.md). Modèle MERISE (MCD, MLD, MPD) : [docs/db/merise.md](docs/db/merise.md).

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

Tout est calculé côté serveur : chaque gain ou débit écrit un `PointEvent` et le solde dans la même transaction ; un débit exige un solde suffisant.

| Action | Gain |
|---|---|
| Une page de Flow lue | +10 |
| Une Bonne dose donnée | +2 |
| Une réaction (commentaire, republication) | +5 |
| Une connexion quotidienne | +25 |
| Bonus aléatoire | variable |
| Combo (actions enchaînées) | multiplicateur |

**L'Épicerie** : sachet de sucre (150), ticket à gratter (300), loot box (600), paquet de cigarettes (1000). Une commande génère une adresse de livraison et un numéro de suivi, consultables dans Mes commandes.

**Clairvoyance** : 10 compétences pour espionner un ami (dernière connexion, solde, série, temps de scroll, derniers achats, visites de profil, plus gros gain, heures de pointe, cercle proche, dossier complet). Achat unique par cible, cible jamais notifiée, métadonnées seulement.

## Répartition

| Rôle | Responsabilités |
|---|---|
| 1. Comptes et sécurité | Auth, JWT, validation, erreurs normalisées, Swagger, tests d'auth |
| 2. Contenu et fil | Posts (CRUD), uploads, Flow, Mon cercle, likes, commentaires, abonnements, Instants |
| 3. Points et boutique | Points serveur, L'Épicerie, commandes, Clairvoyance, tirages |
| 4. Messages, design, qualité | Messages, recherche, profil, intégration du design, README, Docker, tests de bout en bout |

## Mentions

Les marques citées le sont en texte uniquement, sans logo.
