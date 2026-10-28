# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Projet

Détox : réseau social à récompenses, présenté comme un vrai produit (le ton de l'interface est celui d'une entreprise qui vend son service, sans mention de projet scolaire ni de contenu fictif). On gagne des points en scrollant et on les dépense dans une boutique et des compétences d'espionnage. Le texte de l'app, les commentaires et les messages d'erreur sont en **français** ; garder cette langue. Le vocabulaire métier (Flow, Instant, Bonne dose, Sérénité, L'Épicerie, Clairvoyance) est défini dans le README.

Tout tourne dans une seule app Next.js 16 (App Router, `cacheComponents: true`). Le contrat d'API du README (format d'erreur, `{"items":[...]}`, codes) est la référence.

Textes visibles (interface, OpenAPI, README) : pas de mention « parodie », « fictif » ou « projet scolaire ». Les noms internes (`fakeAddress`, « maquette » pour le jeu de données de démo) restent tels quels.

Les commits suivent Conventional Commits (`feat:`, `fix:`, `test:`…) : commitlint les vérifie dans le hook husky `commit-msg` et en CI. La CI lance `lint`, `typecheck`, `test` et `build`.

## Commandes

```bash
pnpm dev                      # serveur de dev
pnpm build                    # build de prod (fait aussi le typecheck)
pnpm exec next start -p 3123  # servir le build
pnpm lint                     # ESLint (règles type-aware sur les promesses, react-you-might-not-need-an-effect en erreur)
pnpm typecheck                # next typegen (types RouteContext/PageProps) puis tsc ; à relancer après ajout d'une route
pnpm test                     # Vitest, une passe (pnpm test:watch pour le mode watch)
pnpm exec vitest run app/api/posts        # un dossier ou un fichier
pnpm exec vitest run -t "Bonne dose"      # les tests dont le nom contient ce texte

# Base MongoDB (obligatoire pour lancer l'app)
docker compose up -d --wait   # MongoDB 7 en replica set sur 27017
pnpm db:indexes               # prisma db push + index que Prisma ne sait pas décrire
pnpm db:seed                  # boutique, comptes de la maquette (@detox.test), aléatoires (@seed.detox.local), admin et user (@detox.app)
pnpm db:smoke                 # vérifie en lecture seule que la base est prête
pnpm db:ping                  # test de connexion + nombre de documents par collection
pnpm exec prisma generate     # après un changement de prisma/schema.prisma, puis pnpm db:indexes
TEST_MONGODB_URI="mongodb://localhost:27017/detox_test?directConnection=true" pnpm test   # + tests de routes et lib/db
```

Node 22.9 ou plus (`--env-file-if-exists`). Variables : modèle dans `.env.example`. `.env.local` l'emporte sur `.env`, pour Next, pour `prisma.config.ts` et pour les scripts `db:*`.

- `JWT_SECRET`, `AUTH_SECRET` : obligatoires en production, valeurs de dev par défaut sinon.
- `AUTH_TRUST_HOST=true` : sans lui, `next start` en local renvoie `UntrustedHost` sur toutes les routes NextAuth.
- `MONGODB_URI` : la base de l'app et des scripts `db:*`. Base `dev` en développement, `prod` en production (le secret `MONGODB_URI_PROD` et la variable Vercel doivent viser `/prod`). Avec podman, viser `127.0.0.1` plutôt que `localhost` (IPv6).
- `UPLOADTHING_TOKEN`, `FILES_API_SECRET` : `/api/files` uniquement. Le build passe sans elles.

Comptes de la maquette, créés par `pnpm db:seed` : `alex@detox.test`, `lina@detox.test`, `karim@detox.test`… mot de passe `demo1234`. Comptes aléatoires `@seed.detox.local` : mot de passe `detox1234`. `admin@detox.app` et `user@detox.app` (rôles `admin` et `user`) sont créés par le seed s'ils n'existent pas, jamais modifiés ensuite ; mots de passe : `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`, sinon tirés au hasard et affichés une seule fois par le seed.

## Architecture

### Données : Prisma + MongoDB

- **`lib/db/**`** : Prisma 6 + MongoDB. Schéma dans `prisma/schema.prisma`, mode d'emploi et règles dans `docs/db/README.md`, à lire avant d'écrire une route. L'essentiel :
  - points via `creditPoints`/`spendPoints` uniquement (ils renvoient le `PointEvent`, avec son `label`) ;
  - un achat débite et crée son document dans la même `inTransaction` ;
  - likes et commentaires via `likePost`/`addComment`… (document + compteur) ;
  - `toApiError(err)` convertit les erreurs au format du contrat (`route()` le fait déjà) ;
  - Prisma exige un replica set, même pour une simple écriture ;
  - en prod, `connectDb()` (appelé par `route()`) refuse de démarrer s'il manque un index ;
  - rester sur Prisma 6, la 7 ne gère pas MongoDB.
- **`lib/server/**`** : logique métier au-dessus de `lib/db`, et mise au format du contrat d'API (`lib/types.ts`), qui ne suit pas le modèle Prisma (`name` vient de `displayName`, `status` est calculé depuis `lastActiveAt`, les ids de compétence du front sont traduits par `SKILL_CATALOG`…).
- **`scripts/scenario.ts`** : comptes et contenus de la maquette (alex, ses amis `bot`, posts c1…c4, r1…r4, f0…f39, Instants, boutique), à ids fixes. Seedés par `pnpm db:seed` et avant chaque test de route.
- Le barème (combo, coffre, Sérénité, niveau) est dans `lib/game.ts`, partagé avec le front ; `lib/db/activity.ts` le réexporte. Les prix des compétences sont dans `lib/db/skills.ts` (`SKILLS`).
- Mots de passe : scrypt (`lib/server/password.ts`), y compris le hash figé des comptes aléatoires du seed.
- Les scripts `tsx` (`scripts/*.mts`) ne peuvent pas importer un module qui importe `server-only` (`lib/server/content.ts`…) : le paquet n'est pas installé, seul Next le résout. Ils importent `lib/db` et `lib/server/password.ts` directement.
- Nouveau modèle : un `@@unique` qui porte une règle métier va aussi dans `REQUIRED_INDEXES` (`lib/db/indexes.ts`). `resetDb()` des tests et `purge()` du seed parcourent tous les modèles via `Prisma.dmmf`, rien à ajouter.

### Pièges Prisma sur MongoDB

- `{ champ: null }` ne trouve pas un champ absent du document : filtrer avec `OR: [{ champ: null }, { champ: { isSet: false } }]` (voir `lib/server/conversations.ts`).
- Les relations sont émulées : rien n'empêche d'écrire un id étranger qui n'existe pas, et un `include` d'une relation obligatoire vers un document absent fait échouer la requête.
- `groupBy` avec `orderBy` sur `_count` n'est pas fiable : trier le résultat en JS.
- Le type `User` de `@prisma/client` contient `passwordHash`, que le client omet : dans `lib/server`, utiliser `UserRow` (`lib/db`).

### Frontière serveur / client

- **Le front** (`app/(app)`, `app/(auth)`, `components`) n'importe **jamais** `lib/server` ni `lib/db`. Il ne contient aucune donnée en dur et passe uniquement par l'API.
- **Modules partagés front/serveur** : `lib/types.ts` (types de réponse de l'API), `lib/game.ts` (barème de points et tirages), `lib/validation.ts` (regex et limites de saisie).
- **Règle métier** : les montants de points sont toujours calculés par le serveur, jamais envoyés par le client.

### API (`app/api/**/route.ts`)

Chaque handler suit le même schéma :

```ts
export const POST = route(async (request, ctx: RouteContext<"/api/x/[id]">) => {
  const user = await requireUser(request);          // Bearer → User (sans passwordHash), sinon ApiError UNAUTHORIZED
  const body = await readBody(request, { text: "string" }); // refuse les champs inconnus
  ...
  return json({ ...(await withPoints(user.id, gains)) });
});
```

- `lib/server/http.ts` :
  - `route()` connecte la base, puis convertit toute `ApiError` levée en `{"error":{"code","message"}}`, avec le statut tiré de la table `STATUS` (un nouveau code s'y ajoute), et les erreurs de `lib/db` via `toApiError`.
  - Les ids sont des ObjectId : `toId(id, "Post")` de `lib/db` (400 si mal formé). `assertId()` ne sert plus qu'aux pseudos.
- `lib/server/points.ts` :
  - `credit(userId, amount, type, label, { combo? })` et `debit()` passent par `creditPoints`/`spendPoints` ;
  - `debit()` lève `INSUFFICIENT_POINTS` avec le montant manquant ;
  - les actions qui rapportent des points renvoient `withPoints()`, soit `{points, gains}`.
- `lib/server/views.ts` met en forme les documents (`publicUser`, `postViews` en lot, `stats`) : ids publics seulement, jamais de hash.
- `lib/server/posts.ts` : `visibleWhere(viewerId)` cache les posts `closeFriends` hors du cercle proche ; `userAndPost()` répond 404 pour un post invisible.
- Le Flow tire chaque page d'une réserve de photos récentes (il repart du début quand il n'y en a plus) et la mémorise dans `FlowPage` pour la relire à l'identique.
- Les réponses automatiques des comptes `bot` sont stockées avec un `createdAt` dans le futur et filtrées à la lecture. Il n'y a aucun timer serveur. Leurs premiers messages (`STARTER_MESSAGES`, `lib/server/content.ts`) amorcent le fil à la première lecture.

### Médias : deux circuits distincts

- **`POST /api/posts`** (multipart `media` + `caption`) garde le fichier dans la collection `media` (15 Mo max, limite d'un document Mongo). `GET /api/media/[id]` le sert.
- **`/api/files`** passe par `files-sdk` vers UploadThing. Il n'est pas encore relié aux posts ni authentifié.
  - `lib/upload-router.ts` n'autorise que les opérations `upload` et `url`.
  - Il refuse une clé choisie par le client et n'accepte que des images, sans SVG : il vérifie le type déclaré et les premiers octets (`lib/image-signature.ts`).
  - 4 Mo maximum par fichier.
  - Le client UploadThing (`lib/files.ts`) et le routeur sont créés à la première requête, pas à l'import, pour que `next build` passe sans variables.

### Authentification (deux couches)

1. **NextAuth v5** (`auth.ts`, route `app/api/auth/[...nextauth]`) :
   - provider `credentials`, qui appelle `lib/server/accounts.ts` (fonctions aussi utilisées par `POST /api/auth/{login,register}`);
   - session JWT dans un cookie httpOnly ;
   - la session expose `session.accessToken`, le JWT de l'API, ré-émis par le callback `jwt` s'il a expiré.
2. **API** : HS256 maison dans `lib/server/auth.ts`. `requireUser` n'accepte **que** le Bearer, pas le cookie NextAuth. Seule exception : `/api/media/[id]` accepte aussi le cookie, parce qu'une balise `<img>` n'envoie pas de Bearer.

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

Deux projets dans `vitest.config.mts` :

- **`unit`** : tests sans base (`lib/game`, `lib/server/http`, `lib/server/auth`, `proxy.ts`, `/api/openapi`, `/api/files`, scripts). Toujours lancés.
- **`db`** : routes (`app/api/**`), `lib/server/{points,recommend,require-user}.test.ts` et `lib/db/db.test.ts`. Lancés seulement si `TEST_MONGODB_URI` est défini (base dont le nom finit par `_test`). `test/db-global.ts` pousse le schéma et les index une fois ; `test/db-setup.ts` vide la base et la remplit avec la maquette avant **chaque** test ; un fichier à la fois.

- Les tests de routes sont colocalisés (`app/api/<domaine>/<domaine>.test.ts`) et appellent directement les handlers exportés par `route.ts`, sans serveur, via `call()` de `test/api.ts` : `call(likes.POST, { as: "alex", params: { id: POSTS.c1 } })`. `as` accepte un prénom de la maquette ou un id brut et signe un Bearer, `token` envoie un Bearer brut, `body` est un objet JSON, une `FormData` ou une chaîne.
- `test/db.ts` : `USERS` et `POSTS` (ids fixes de la maquette), `userRow("alex")` relit un compte, `postKeys(items)` redonne `c1`, `f7`… Pour préparer un cas particulier, écrire directement avec `db` (Prisma).
- Aléatoire : `vi.spyOn(Math, "random")`. Temps : `freezeTime()` et `advanceTime()` de `test/api.ts`, qui ne simulent que `Date`. Les `@default(now())` de Prisma sont calculés par le moteur, pas par `Date` : passer `createdAt: new Date()` quand un test joue avec l'horloge.
- Modules mockés : `@/auth` pour `/api/media` et `proxy.ts`, parce que `auth()` lit `next/headers` hors requête ; `@/lib/files` pour `/api/files`.
- `next-auth` est inliné dans `vitest.config.mts` (il importe `next/server` sans extension) et `server-only` est remplacé par un module vide.

### CI

- `check` : lint, typecheck, tests unitaires, build.
- `db` : MongoDB du `compose.yaml`, `db:indexes`, seed deux fois, `db:smoke`, puis toute la suite sur `detox_test`.
- `prod-smoke.yml` : après un push sur `main`, `pnpm db:ping` sur la base du secret `MONGODB_URI_PROD` (environnement GitHub `production`) : test de connexion et nombre de documents par collection, en lecture seule. Jamais de tests, de seed ni de `db:indexes` sur cette base.
- `deploy-vercel.yml` : après un push sur `main`, déploie en production avec le CLI Vercel une fois approuvé (relecteurs requis de l'environnement `vercel-production`). Secrets : `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

### Pièges Next 16 rencontrés

- Avec `cacheComponents`, un hook client d'exécution (`usePathname`, `useSearchParams`) dans un layout partagé doit être sous `<Suspense>`, sinon les routes dynamiques sans `generateStaticParams` cassent le build. C'est pour ça que `BottomNav` est sous `Suspense`.
- Les pages à paramètres (`messages/[id]`, `u/[username]`) lisent `params` dans un composant enfant enveloppé de `Suspense`.
- Pendant `pnpm build`, les routes `/api/*` affichent « needs to bail out of prerendering » : c'est attendu, ces routes lisent la requête.
