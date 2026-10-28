# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Projet

Détox : parodie de réseau social « addictif » (projet scolaire, tout est fictif). On gagne des points en scrollant et on les dépense dans une boutique et des compétences d'espionnage. Le texte de l'app, les commentaires et les messages d'erreur sont en **français** ; garder cette langue. Le vocabulaire métier (Flow, Instant, Bonne dose, Sérénité, L'Épicerie, Clairvoyance) est défini dans le README.

Tout tourne dans une seule app Next.js 16 (App Router, `cacheComponents: true`). Le contrat d'API du README (format d'erreur, `{"items":[...]}`, codes) est la référence. Le README parle encore par endroits d'un « back Express » : il n'existe pas.

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

# Base MongoDB (couche Prisma, voir plus bas)
docker compose up -d --wait   # MongoDB 7 en replica set sur 27017
pnpm db:indexes               # prisma db push + index que Prisma ne sait pas décrire
pnpm db:seed                  # boutique + comptes @seed.detox.local (mot de passe detox1234)
TEST_MONGODB_URI="mongodb://localhost:27017/detox_test?directConnection=true" pnpm test   # lance aussi lib/db/db.test.ts
```

Node 22.9 ou plus (`--env-file-if-exists`). Variables : modèle dans `.env.example`. `.env.local` l'emporte sur `.env`, pour Next, pour `prisma.config.ts` et pour les scripts `db:*`.

- `JWT_SECRET`, `AUTH_SECRET` : obligatoires en production, valeurs de dev par défaut sinon.
- `AUTH_TRUST_HOST=true` : sans lui, `next start` en local renvoie `UntrustedHost` sur toutes les routes NextAuth.
- `MONGODB_URI` : couche Prisma uniquement.
- `UPLOADTHING_TOKEN`, `FILES_API_SECRET` : `/api/files` uniquement. Le build passe sans elles.

Comptes de l'API actuelle (base mockée) : `alex@detox.test` (compte démo), `lina@detox.test`, `karim@detox.test`… mot de passe `demo1234`.

## Architecture

### Deux couches de données qui coexistent

1. **`lib/server/**` : base mockée en mémoire, celle qu'utilisent toutes les routes `app/api` aujourd'hui.** `db.ts` contient des `Map` sur `globalThis`, seedées depuis `seed.ts` au premier accès et **réinitialisées à chaque redémarrage**. Ces fichiers importent `server-only`.
2. **`lib/db/**` : Prisma 6 + MongoDB, la cible.** Aucune route ni page ne l'importe encore. Seuls `scripts/seed.mts`, `scripts/indexes.mts` et `lib/db/db.test.ts` l'utilisent. Le schéma est dans `prisma/schema.prisma` ; le mode d'emploi et les règles sont dans `docs/db/README.md`, à lire avant de brancher une route dessus. L'essentiel :
   - points via `creditPoints`/`spendPoints` uniquement ;
   - un achat débite et crée son document dans la même `inTransaction` ;
   - likes et commentaires via `likePost`/`addComment`… (document + compteur) ;
   - `toApiError(err)` convertit les erreurs au format du contrat ;
   - `toPublicUser`, `toSelfJSON` et `toDrawJSON` mettent en forme les réponses ;
   - Prisma exige un replica set, même pour une simple écriture ;
   - en prod, `connectDb()` refuse de démarrer s'il manque un index ;
   - rester sur Prisma 6, la 7 ne gère pas MongoDB.

Les deux couches ne partagent pas leurs constantes et **ne concordent pas** :

| Constante | `lib/game.ts` (mock) | `lib/db/activity.ts` (Prisma) |
|---|---|---|
| Coffre | toutes les 4 pages | tous les 50 posts |
| Combo | fenêtre de 5 s | fenêtre de 10 s |
| Sérénité | −3 par page | −5 par page |

Les compétences de la Clairvoyance existent aussi deux fois : `lib/server/seed.ts` et `lib/db/skills.ts`. Côté hash de mot de passe, le mock utilise scrypt et le seed Prisma bcrypt. Une modification du barème est à reporter des deux côtés, ou à signaler.

### Frontière serveur / client

- **Le front** (`app/(app)`, `app/(auth)`, `components`) n'importe **jamais** `lib/server` ni `lib/db`. Il ne contient aucune donnée en dur et passe uniquement par l'API.
- **Modules partagés front/serveur** : `lib/types.ts` (types de réponse de l'API), `lib/game.ts` (barème de points et tirages), `lib/validation.ts` (regex et limites de saisie).
- **Règle métier** : les montants de points sont toujours calculés par le serveur, jamais envoyés par le client.

### API (`app/api/**/route.ts`)

Chaque handler suit le même schéma :

```ts
export const POST = route(async (request, ctx: RouteContext<"/api/x/[id]">) => {
  const user = requireUser(request);                // Bearer → DbUser, sinon ApiError UNAUTHORIZED
  const body = await readBody(request, { text: "string" }); // refuse les champs inconnus
  ...
  return json({ ...withPoints(user.id, gains) });
});
```

- `lib/server/http.ts` :
  - `route()` convertit toute `ApiError` levée en `{"error":{"code","message"}}`, avec le statut tiré de la table `STATUS` ; un nouveau code d'erreur s'ajoute dans cette table.
  - `assertId()` vérifie les ids des segments dynamiques (400 si mal formé).
- `lib/server/points.ts` :
  - `credit()` et `debit()` écrivent un `PointEvent` ;
  - `debit()` lève `INSUFFICIENT_POINTS` ;
  - les actions qui rapportent des points renvoient `withPoints()`, soit `{points, gains}`.
- `lib/server/views.ts` met en forme les documents de la DB (`publicUser`, `postView`, `stats`) : ids publics seulement, jamais de hash.
- Les posts du Flow (`f0`, `f1`…) ne sont pas stockés : `findPost()` les régénère de façon déterministe avec `flowPage()`.
- Les réponses automatiques des comptes seedés (`bot: true`) sont stockées avec un `at` dans le futur et filtrées à la lecture. Il n'y a aucun timer serveur.

### Médias : deux circuits distincts

- **`POST /api/posts`** (multipart `media` + `caption`) garde le fichier dans la base mockée. `GET /api/media/[id]` le sert.
- **`/api/files`** passe par `files-sdk` vers UploadThing. Il n'est pas encore relié aux posts ni authentifié.
  - `lib/upload-router.ts` n'autorise que les opérations `upload` et `url`.
  - Il refuse une clé choisie par le client et n'accepte que des images, sans SVG : il vérifie le type déclaré et les premiers octets (`lib/image-signature.ts`).
  - 4 Mo maximum par fichier.
  - Le client UploadThing (`lib/files.ts`) et le routeur sont créés à la première requête, pas à l'import, pour que `next build` passe sans variables.

### Authentification (deux couches)

1. **NextAuth v5** (`auth.ts`, route `app/api/auth/[...nextauth]`) :
   - providers `credentials` et `demo`, qui appellent `lib/server/accounts.ts` (fonctions aussi utilisées par `POST /api/auth/{login,register,demo}`) ;
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

- Les tests de routes sont colocalisés (`app/api/<domaine>/<domaine>.test.ts`) et appellent directement les handlers exportés par `route.ts`, sans serveur, via `call()` de `test/api.ts` : `call(likes.POST, { as: "alex", params: { id: "c1" } })`. `as` signe un Bearer pour cet id, `token` envoie un Bearer brut, `body` est un objet JSON, une `FormData` ou une chaîne.
- `test/setup.ts` remet la DB mockée à son état seedé avant chaque test. Pour préparer un cas particulier, on écrit directement dans `db()` ou `accountOf()`.
- Aléatoire : `vi.spyOn(Math, "random")`, sachant que `uid()` en dépend aussi. Temps : `freezeTime()` et `advanceTime()` de `test/api.ts`, qui ne simulent que `Date`.
- Modules mockés : `@/auth` pour `/api/media` et `proxy.ts`, parce que `auth()` lit `next/headers` hors requête ; `@/lib/files` pour `/api/files`.
- `next-auth` est inliné dans `vitest.config.mts` (il importe `next/server` sans extension) et `server-only` est remplacé par un module vide.
- `lib/db/db.test.ts` (Prisma) n'est lancé que si `TEST_MONGODB_URI` est défini. Il vide la base, dont le nom doit finir par `_test`.

### Pièges Next 16 rencontrés

- Avec `cacheComponents`, un hook client d'exécution (`usePathname`, `useSearchParams`) dans un layout partagé doit être sous `<Suspense>`, sinon les routes dynamiques sans `generateStaticParams` cassent le build. C'est pour ça que `BottomNav` est sous `Suspense`.
- Les pages à paramètres (`messages/[id]`, `u/[username]`) lisent `params` dans un composant enfant enveloppé de `Suspense`.
- Pendant `pnpm build`, les routes `/api/*` affichent « needs to bail out of prerendering » : c'est attendu, ces routes lisent la requête.
