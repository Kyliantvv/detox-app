# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Projet

Détox : parodie de réseau social « addictif » (projet scolaire, tout est fictif). On gagne des points en scrollant et on les dépense dans une boutique et des compétences d'espionnage. Le texte de l'app, les commentaires et les messages d'erreur sont en **français** ; garder cette langue. Le vocabulaire métier (Flow, Instant, Bonne dose, Sérénité, L'Épicerie, Clairvoyance) est défini dans le README.

Le README décrit aussi une cible Express + MongoDB + Vite : **ce n'est pas le code actuel**. Aujourd'hui, tout tourne dans Next.js 16 (App Router, `cacheComponents: true`), avec une base mockée en mémoire. Le contrat d'API du README (format d'erreur, `{"items":[...]}`, codes) reste la référence.

## Commandes

```bash
pnpm dev                      # serveur de dev
pnpm build                    # build de prod (fait aussi le typecheck)
pnpm exec next start -p 3123  # servir le build
pnpm lint                     # ESLint
pnpm exec tsc --noEmit -p .   # typecheck seul
pnpm exec next typegen        # régénère les types RouteContext/PageProps après ajout d'une route
```

Il n'y a pas encore de framework de test : on vérifie avec `pnpm build` puis des scénarios curl contre `next start`.

Les secrets sont dans `.env.local` (non versionné, modèle dans `.env.example`) : `JWT_SECRET`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`. Sans `AUTH_TRUST_HOST`, `next start` en local renvoie `UntrustedHost` sur toutes les routes NextAuth.

Comptes seedés : `alex@detox.test` (compte démo), `lina@detox.test`, `karim@detox.test`… mot de passe `demo1234`.

## Architecture

### Frontière serveur / client

- **`lib/server/**`** : tout ce qui touche aux données. `db.ts` contient la DB mockée : des `Map` sur `globalThis`, seedées depuis `seed.ts` au premier accès et **réinitialisées à chaque redémarrage**. Ces fichiers importent `server-only`.
- **Le front** (`app/(app)`, `app/(auth)`, `components`) n'importe **jamais** `lib/server`. Il ne contient aucune donnée en dur et passe uniquement par l'API.
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

### Pièges Next 16 rencontrés

- Avec `cacheComponents`, un hook client d'exécution (`usePathname`, `useSearchParams`) dans un layout partagé doit être sous `<Suspense>`, sinon les routes dynamiques sans `generateStaticParams` cassent le build. C'est pour ça que `BottomNav` est sous `Suspense`.
- Les pages à paramètres (`messages/[id]`, `u/[username]`) lisent `params` dans un composant enfant enveloppé de `Suspense`.
- Pendant `pnpm build`, les routes `/api/*` affichent « needs to bail out of prerendering » : c'est attendu, ces routes lisent la requête.
