# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Projet

Détox : parodie de réseau social « addictif » (projet scolaire, tout est fictif). On gagne des points en scrollant et on les dépense dans une boutique et des compétences d'espionnage. Le texte de l'app, les commentaires et les messages d'erreur sont en **français** ; garder cette langue. Le vocabulaire métier (Flow, Instant, Bonne dose, Sérénité, L'Épicerie, Clairvoyance) est défini dans le README.

Tout tourne dans une seule app Next.js 16 (App Router, `cacheComponents: true`) sur MongoDB via Prisma 6. Le contrat d'API du README (format d'erreur, `{"items":[...]}`, codes) est la référence. Le README parle encore par endroits d'un « back Express » : il n'existe pas.

Les commits suivent Conventional Commits (`feat:`, `fix:`, `test:`…) : commitlint les vérifie dans le hook husky `commit-msg` et en CI. Le hook `pre-commit` lance `pnpm build` et `pnpm test`. La CI (`.github/workflows/ci.yml`, sur PR et push vers `develop` et `main`) lance `lint`, `typecheck`, `test` et `build`, puis un job `db` (index, seed, `db:smoke`, tests sur MongoDB).

## Commandes

```bash
pnpm dev                      # serveur de dev
pnpm build                    # build de prod (fait aussi le typecheck) ; `prebuild` régénère lib/openapi.generated.json
pnpm exec next start -p 3123  # servir le build
pnpm lint                     # ESLint (règles type-aware sur les promesses, react-you-might-not-need-an-effect en erreur)
pnpm typecheck                # next typegen (types RouteContext/PageProps) puis tsc ; à relancer après ajout d'une route
pnpm test                     # Vitest, une passe (pnpm test:watch pour le mode watch)
pnpm exec vitest run app/api/posts        # un dossier ou un fichier
pnpm exec vitest run -t "Bonne dose"      # les tests dont le nom contient ce texte
pnpm openapi                  # régénère la spec OpenAPI depuis les commentaires @openapi des routes (Swagger sur /api/docs)

# Base MongoDB
docker compose up -d --wait   # MongoDB 7 en replica set sur 27017
pnpm db:indexes               # prisma db push + index que Prisma ne sait pas décrire
pnpm db:seed                  # boutique, comptes admin/user, maquette @detox.test et faux comptes @seed.detox.local
pnpm db:smoke                 # vérifie la base après seed (utilisé par la CI)
pnpm db:ping                  # test de connexion en lecture seule (utilisé par prod-smoke)
TEST_MONGODB_URI="mongodb://localhost:27017/detox_test?directConnection=true" pnpm test   # lance aussi les tests qui lisent la base
```

Node 22.9 ou plus (`--env-file-if-exists`). Variables : modèle dans `.env.example`. `.env.local` l'emporte sur `.env`, pour Next, pour `prisma.config.ts` et pour les scripts `db:*`.

- `JWT_SECRET`, `AUTH_SECRET` : obligatoires en production, valeurs de dev par défaut sinon.
- `AUTH_TRUST_HOST=true` : sans lui, `next start` en local renvoie `UntrustedHost` sur toutes les routes NextAuth.
- `MONGODB_URI` : obligatoire pour toute route qui lit la base, donc pour l'app. `next build` et les tests unitaires passent sans elle.
- `UPLOADTHING_TOKEN`, `FILES_API_SECRET` : `/api/files` et les lectures d'URL de média. Le build passe sans elles.

Comptes après `pnpm db:seed` :
- maquette : `alex@detox.test` (compte démo), `lina@detox.test`, `karim@detox.test`… mot de passe `demo1234` (`scripts/scenario.ts`) ;
- `admin@detox.app` et `user@detox.app` : mots de passe dans `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`, sinon tirés au hasard et affichés une fois ;
- faux comptes `@seed.detox.local` : `detox1234`.

## Architecture

### Base de données

Toutes les routes passent par `lib/db` (Prisma 6 + MongoDB). Le schéma est dans `prisma/schema.prisma` ; le mode d'emploi et les règles sont dans `docs/db/README.md`, à lire avant de toucher à une écriture en base. L'essentiel :
- points via `creditPoints`/`spendPoints` uniquement ;
- un achat débite et crée son document dans la même `inTransaction` ;
- likes et commentaires via `likePost`/`addComment`… (document + compteur) ;
- `toApiError(err)` convertit les erreurs au format du contrat ;
- `toPublicUser`, `toSelfJSON` et `toDrawJSON` mettent en forme les réponses ;
- Prisma exige un replica set, même pour une simple écriture ;
- en prod, `connectDb()` refuse de démarrer s'il manque un index ;
- rester sur Prisma 6, la 7 ne gère pas MongoDB.

`lib/game.ts` porte le barème (coffre, combo, Sérénité, points) pour le serveur et le front ; `lib/db/activity.ts` le relit, ne le redéfinit pas. Les prix des compétences de la Clairvoyance sont dans `lib/db/skills.ts`. Les mots de passe sont hachés par scrypt (`lib/server/password.ts`), y compris dans les seeds.

### Frontière serveur / client

- **Le front** (`app/(app)`, `app/(auth)`, `components`) n'importe **jamais** `lib/server` ni `lib/db`. Il ne contient aucune donnée en dur et passe uniquement par l'API.
- **Modules partagés front/serveur** : `lib/types.ts` (types de réponse de l'API), `lib/game.ts` (barème de points et tirages), `lib/validation.ts` (regex et limites de saisie), `lib/media-types.ts` (types et taille des fichiers).
- **Règle métier** : les montants de points sont toujours calculés par le serveur, jamais envoyés par le client.

### API (`app/api/**/route.ts`)

Chaque handler suit le même schéma :

```ts
export const POST = route(async (request, ctx: RouteContext<"/api/x/[id]">) => {
  const user = await requireUser(request);          // Bearer → User, sinon ApiError UNAUTHORIZED
  const body = await readBody(request, { text: "string" }); // refuse les champs inconnus
  ...
  return json({ ...(await withPoints(user.id, gains)) });
});
```

- Chaque route porte un commentaire `@openapi` : `pnpm openapi` en tire la spec, servie sur `/api/docs`. Une route ajoutée ou modifiée met son commentaire à jour.
- `lib/server/http.ts` :
  - `route()` convertit toute `ApiError` levée en `{"error":{"code","message"}}`, avec le statut tiré de la table `STATUS` ; un nouveau code d'erreur s'ajoute dans cette table. Les erreurs de `lib/db` passent par `toApiError`.
  - `assertId()` vérifie les ids des segments dynamiques (400 si mal formé).
- `lib/server/points.ts` :
  - `credit()` et `debit()` écrivent un `PointEvent` ; `credit()` renvoie un tableau de gains, `debit()` un seul `PointEvent` ;
  - `debit()` lève `INSUFFICIENT_POINTS` ;
  - les actions qui rapportent des points renvoient `await withPoints()`, soit `{points, gains}`.
- `lib/server/views.ts` met en forme les documents de la DB (`publicUser`, `postView`, `stats`) : ids publics seulement, jamais de hash.
- Le Flow vient de `lib/server/recommend.ts` : chaque page est mémorisée dans `FlowPage` pour rester identique à la relecture.
- Les réponses automatiques des comptes `bot` sont stockées avec un `at` dans le futur et filtrées à la lecture. Il n'y a aucun timer serveur.

### Médias

Un seul circuit, en trois temps :
1. **`/api/files`** (`files-sdk` vers UploadThing, Bearer obligatoire) : presign, PUT, puis complete. `onUpload` écrit dans `media` la clé liée à son auteur (`usedAt: null`).
2. **`claimMedia`** (`lib/server/media.ts`) : `POST /api/posts` ou l'envoi d'un message joint le fichier par sa clé. Seul l'auteur peut réserver sa clé, une seule fois, tout ou rien.
3. L'URL publique vient du CDN d'UploadThing (`getFiles().url(key)`).

Règles :
- `lib/upload-router.ts` n'autorise que l'opération `upload`.
- Il refuse une clé choisie par le client et vérifie le type déclaré puis les premiers octets (`lib/media-signature.ts`).
- Types acceptés (`lib/media-types.ts`) : images sans SVG, vidéos mp4/webm et audio webm/ogg/mp4. L'audio ne sert qu'aux messages vocaux, un post reste une photo ou une vidéo (une vidéo devient un reel).
- 4 Mo maximum par fichier (`MAX_UPLOAD_SIZE`).
- Le client UploadThing (`lib/files.ts`) et le routeur sont créés à la première requête, pas à l'import, pour que `next build` passe sans variables.

### Authentification (deux couches)

1. **NextAuth v5** (`auth.ts`, route `app/api/auth/[...nextauth]`) :
   - providers `credentials` et `demo`, qui appellent `lib/server/accounts.ts` (fonctions aussi utilisées par `POST /api/auth/{login,register,demo}`) ;
   - session JWT dans un cookie httpOnly ;
   - la session expose `session.accessToken`, le JWT de l'API, ré-émis par le callback `jwt` s'il a expiré.
2. **API** : HS256 maison dans `lib/server/auth.ts`. `requireUser` n'accepte **que** le Bearer, jamais le cookie NextAuth. Il met aussi à jour la dernière activité de l'utilisateur.

`proxy.ts` (le middleware renommé de Next 16) redirige les pages selon la session. Son matcher exclut les fichiers statiques **par extension** : les pseudos contiennent des points (`/u/lina.m`).

Le type `JWT` de `@auth/core` n'est pas augmentable (pnpm ne hoiste pas ce paquet). Ses champs sont lus avec des gardes dans `auth.ts`.

### Données côté client

- `lib/api-client.ts` :
  - `useApiData<T>(path)` fait les lectures via SWR ; **la clé de cache est le chemin**, donc `mutate("/api/me")` rafraîchit partout ;
  - `useApi()` fait les mutations, avec le token de session ;
  - un 401 déclenche `signOut()`.
- `useMe()` (`GET /api/me`) est la source du solde, de la série et des stats.
- `lib/gains.ts` : après une action, `useApplyGains()(response)` affiche les gains dans le toast et revalide `/api/me`.
- `AppShell` masque l'UI tant que la session charge.
- Après connexion, `window.location.assign("/")` fait une navigation complète **volontairement** : on repart avec un cache routeur et un cache SWR vides.

### Tests (Vitest)

`vitest.config.mts` définit deux projets :
- **`unit`** : `lib/**`, `scripts/**`, `proxy.test.ts`, spec OpenAPI. Sans base.
- **`db`** : routes (`app/api/**`), `lib/db` et `lib/server/{points,recommend,require-user}.test.ts`. Il n'existe que si `TEST_MONGODB_URI` est défini (MongoDB en replica set, nom de base en `_test`) ; sans elle, `pnpm test` saute ces tests. Un fichier à la fois, une base vidée puis remplie avec la maquette (`scripts/scenario.ts`) avant chaque test (`test/db-setup.ts`, `test/db.ts`) ; `test/db-global.ts` pousse le schéma et les index une fois par lancement.

Outils :
- Les tests de routes sont colocalisés (`app/api/<domaine>/<domaine>.test.ts`) et appellent directement les handlers exportés par `route.ts`, sans serveur, via `call()` de `test/api.ts` : `call(likes.POST, { as: "alex", params: { id: "c1" } })`. `as` signe un Bearer pour ce compte de la maquette ou cet id, `token` envoie un Bearer brut, `body` est un objet JSON, une `FormData` ou une chaîne.
- Pour préparer un cas particulier, on écrit directement dans `db` (`lib/db`) ; `userRow()` et `postKeys()` de `test/db.ts` relisent les comptes et les posts de la maquette.
- Aléatoire : `vi.spyOn(Math, "random")`. Temps : `freezeTime()` et `advanceTime()` de `test/api.ts`, qui ne simulent que `Date`.
- Modules mockés : `@/lib/files` pour `/api/files`, `/api/posts` et les messages ; `@/auth` pour `proxy.ts`.
- `next-auth` est inliné dans `vitest.config.mts` (il importe `next/server` sans extension) et `server-only` est remplacé par un module vide.

### Pièges Next 16 rencontrés

- Avec `cacheComponents`, un hook client d'exécution (`usePathname`, `useSearchParams`) dans un layout partagé doit être sous `<Suspense>`, sinon les routes dynamiques sans `generateStaticParams` cassent le build. C'est pour ça que `BottomNav` est sous `Suspense`.
- Les pages à paramètres (`messages/[id]`, `u/[username]`) lisent `params` dans un composant enfant enveloppé de `Suspense`.
- Pendant `pnpm build`, les routes `/api/*` affichent « needs to bail out of prerendering » : c'est attendu, ces routes lisent la requête.
