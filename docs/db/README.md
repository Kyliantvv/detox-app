# Base de données

MongoDB (Atlas en prod, Docker en local), via Prisma 6. Le schéma est dans `prisma/schema.prisma`, les helpers dans `lib/db/` ; le modèle conceptuel est dans [merise.md](merise.md).

Prisma 7 ne gère pas encore MongoDB : rester sur la 6.19 tant que ce n'est pas le cas.

## Mise en route

**En local, avec Docker :**

```bash
docker compose up -d --wait   # MongoDB 7 en replica set sur le port 27017 (MONGO_PORT pour en changer)
echo 'MONGODB_URI=mongodb://localhost:27017/detox?directConnection=true' >> .env.local   # l'emporte sur .env
pnpm db:indexes
pnpm db:seed
```

**Sur Atlas :**

1. Dans Atlas : créer un cluster (le palier gratuit M0 suffit), un utilisateur de base, et autoriser son IP dans *Network Access*.
2. *Database > Connect > Drivers* : copier la chaîne de connexion.
3. `cp .env.example .env`, puis coller la chaîne dans `MONGODB_URI` en ajoutant le nom de base (`/dev` en développement, `/prod` en production) avant le `?`.
4. Créer les index puis remplir la boutique :

   ```bash
   pnpm db:indexes
   pnpm db:seed
   ```

Node 22.9 ou plus récent (`.nvmrc`) : les scripts utilisent `--env-file-if-exists`.

| Script | Effet |
|---|---|
| `pnpm db:indexes` | `prisma db push` (collections et index du schéma), puis les index que Prisma ne sait pas décrire (uniques partiels, TTL, dans `lib/db/indexes.ts`). N'en supprime aucun. Code de sortie 1 si un index échoue ou manque. À relancer après chaque changement de schéma. |
| `pnpm db:seed` | Crée ou met à jour les 4 articles de L'Épicerie, remplace les comptes de la maquette (`scripts/scenario.ts`), puis les comptes de démo aléatoires : 100 utilisateurs, 500 posts, leurs abonnements, likes et soldes par défaut. Relançable sans doublon. Crée aussi `admin@detox.app` et `user@detox.app` (mots de passe : `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD`, sinon tirés au hasard) |
| `pnpm db:smoke` | Vérifie en lecture seule qu'une base est prête : index requis, boutique, compte alex de la maquette, Instants en cours. Code de sortie 1 sinon. La CI le lance après le seed, sur la base de test et sur la prod. |

**Maquette.** Le compte `alex@detox.test` et ses amis bots (`lina@detox.test`, `karim@detox.test`…, mot de passe `demo1234`), leurs posts (Mon cercle, Reels et 40 posts du Flow), Instants et abonnements. Ids fixes (`USERS`, `POSTS`) : les tests de routes repartent de cet état avant chaque test. Chaque lancement supprime les comptes `@detox.test` avec tout ce qui en dépend, puis les recrée.

**Données de démo.** `pnpm db:seed --users 20 --posts 50` en change le nombre ; `--follows 20` et `--likes 10` règlent le nombre moyen d'abonnements par utilisateur et de likes par post ; `--seed 7` change la graine, et une même graine redonne les mêmes données, à des dates comptées depuis le lancement. Les comptes de démo ont un e-mail en `@seed.detox.local` et le mot de passe `detox1234`. Chaque lancement les supprime avec tout ce qui en dépend (posts, likes, abonnements, et les likes ou commentaires d'autres comptes sur leurs posts), puis les recrée ; les autres comptes ne sont pas touchés. Les posts pointent vers des médias fictifs (`seed/photo-1.jpg`) : rien n'est envoyé sur UploadThing. Chaque compte aléatoire a un journal de points (`point_events`) depuis son inscription : connexions quotidiennes (+25), pages de Flow (+10) et une Bonne dose (+2) par like donné. `points` et `totalEarned` en sont la somme, et `likesCount` compte les likes générés ; aucune dépense n'est générée. Le seed insère tout d'un bloc, sans passer par `creditPoints` ni `likePost`, mais en calcule le même résultat.

Rien ne crée les index au démarrage, en dev non plus : lancer `pnpm db:indexes` sur une base neuve. En production (`NODE_ENV=production`), `connectDb()` refuse de se connecter s'il manque un index requis (`REQUIRED_INDEXES`) : lancer `pnpm db:indexes` avant de déployer. Les index uniques portent des règles métier (une page de Flow créditée une fois, un like par post, une conversation par paire), d'où ce blocage.

## Collections

| Modèle | Collection | Contenu |
|---|---|---|
| `User` | users | Compte, rôle (`user` ou `admin`), profil, solde de points, série, combo, posts vus, temps passé |
| `Post` | posts | Photo ou reel, légende, tags, compteurs de likes, commentaires et republications |
| `Like` | likes | Bonne dose : un par couple (utilisateur, post) |
| `Repost` | reposts | Republication : une par couple (utilisateur, post) |
| `Save` | saves | Post enregistré |
| `Comment` | comments | Commentaire, 500 caractères max |
| `Follow` | follows | Abonnement |
| `CloseFriend` | close_friends | Cercle proche de `ownerId` : qui voit ses posts `closeFriends` |
| `Block` | blocks | Blocage |
| `Story` | stories | Instant ; supprimé par Mongo 24 h après (index TTL) |
| `Conversation` | conversations | Deux participants, une seule conversation par paire |
| `Message` | messages | Message, `readAt` à la lecture |
| `ProfileView` | profile_views | Visite de profil (compétence Clairvoyance) |
| `PointEvent` | point_events | Journal de chaque gain et dépense de points |
| `ShopItem` | shop_items | Article de L'Épicerie |
| `Order` | orders | Commande avec adresse de livraison et suivi |
| `SkillPurchase` | skill_purchases | Compétence Clairvoyance achetée sur une cible |
| `Draw` | draws | Ticket à gratter, loot box ou bonus (`DiceRoll` dans le dossier) ; `prizeItemId` pour l'objet d'une loot box |
| `Media` | media | Fichier envoyé sur UploadThing par `/api/files` : clé, auteur, type, taille ; `usedAt` posé quand `POST /api/posts` le publie (une seule fois) |
| `FlowPage` | flow_pages | Page du Flow telle que la recommandation l'a composée, pour la relire à l'identique |

Le catalogue des 10 compétences n'est pas une collection : c'est la constante `SKILLS` dans `lib/db/skills.ts`.

Valeurs calculées, pas stockées :

- **Niveau** : `levelFor(totalEarned)` (`lib/game.ts`, un niveau tous les 250 points). **En ligne** : `isOnline(lastActiveAt)`, activité il y a moins de 2 min. Les deux sont dans le JSON public de `User` (`level`, `online`).
- **Temps de scroll** (compétence 4) : `flowPagesToday(userId)`. **Sérénité** : `serenityFor(pages, likes)`, 100 moins 3 par page lue et 1 par Bonne dose donnée dans la journée.
- **Coffre** : `postsUntilChest(postsSeen)`, un coffre tous les `CHEST_EVERY` posts (4 pages de 5 posts).
- **Derniers achats** (compétence 5) : les commandes sont dans `Order`, les tickets et loot box dans `Draw`. Lire les deux.

Le barème (combo, coffre, Sérénité, niveau) vient de `lib/game.ts`, partagé avec le front : `lib/db/activity.ts` le réexporte (`CHEST_EVERY`, `COMBO_GAP_MS`, `SERENITY_LOSS_PER_PAGE`…). Seul `IDLE_GAP_MS` (temps passé) lui est propre.

## Utilisation

```ts
import { connectDb, toId } from "@/lib/db";

const db = await connectDb();
const post = await db.post.findUnique({ where: { id: toId(id, "Post") } });
return Response.json(post); // `id`, jamais `_id`
```

`connectDb()` renvoie le client Prisma (`db`), avec une seule connexion par process, y compris pendant le hot reload de `next dev`. Les ids sont des chaînes ; `toId(id)` refuse un id mal formé (400).

Après un changement de `prisma/schema.prisma` : `pnpm exec prisma generate` (fait aussi par `pnpm install`), puis `pnpm db:indexes`.

## Règles

Ces règles évitent des soldes et des compteurs faux. Les helpers de `lib/db` les appliquent déjà.

**Points.** Ne jamais écrire `users.points` à la main. Passer par :

- `creditPoints(userId, amount, type, { flowPage?, refId?, tx? })` : crédite et journalise dans une transaction. `amount` à 0 ne fait rien (tirage perdant). Lève `NotFoundError` si l'utilisateur n'existe pas. Pour une page de Flow, `flowPage` est obligatoire et une même page ne rapporte qu'une fois ; la connexion quotidienne aussi n'est créditée qu'une fois par jour. Le doublon lève une erreur Prisma P2002 (`isDuplicateKey(err)`).
- `spendPoints(userId, amount, type, { refId?, tx? })` : débite et journalise, ou lève `InsufficientPointsError` sans rien écrire. Le débit est conditionnel (`points >= amount`), donc deux achats simultanés ne peuvent pas faire passer le solde sous 0. Une perte (ticket perdant) passe par ici : `creditPoints` refuse les montants négatifs.

Un achat doit débiter et créer son document dans la même transaction, sinon un échec après le débit fait perdre les points. Pour Clairvoyance, `buySkill(buyerId, targetId, skill)` le fait déjà, au prix de `SKILLS` (le `price` d'un `SkillPurchase` est toujours imposé par `SKILLS`). Pour une commande ou un tirage, passer le client de la transaction :

```ts
await inTransaction(undefined, async (tx) => {
  const order = await tx.order.create({ data: { userId, itemId, itemSnapshot, fakeAddress, trackingNumber } });
  await spendPoints(userId, itemSnapshot.price, "shop_purchase", { refId: order.id, tx });
});
```

Si le document ne peut pas être créé (doublon, validation) ou si le solde ne suffit pas, toute la transaction est annulée.

`inTransaction` rejoue la transaction en cas de conflit d'écriture (P2034). Prisma demande un replica set pour toute écriture, pas seulement les transactions : Atlas en fournit un, même en M0, et `compose.yaml` en lance un. Un `mongod` local seul ne suffit pas.

**Likes, republications et commentaires.** Utiliser `likePost`, `unlikePost`, `repostPost`, `unrepostPost`, `addComment` et `removeComment`. Ils écrivent le document et le compteur dans une transaction, ne modifient le compteur que si le document a vraiment été créé ou supprimé, et lèvent `NotFoundError` si le post n'existe pas.

**Activité.** Appeler `recordActivity(userId)` à chaque requête authentifiée : elle met à jour `lastActiveAt` (« Dernière connexion », « En ligne ») et le temps passé du Bilan. `bumpCombo(userId)` enregistre une action qui rapporte et renvoie la longueur du combo ; le multiplicateur reste à définir. `recordPostsSeen(userId, n)` compte les posts vus du Flow (total, jour, coffre).

**Erreurs.** Les helpers lèvent des `DbError` (`NotFoundError`, `InvalidInputError`, `InsufficientPointsError`) qui portent `code` et `status`. Un id mal formé donne `InvalidInputError` (400). Dans une route, `toApiError(err)` renvoie `{ status, body }` au format du contrat (`{ error: { code, message } }`) pour ces erreurs, les ids refusés par Prisma (P2023, 400), les documents introuvables (P2025, 404) et les doublons (P2002, 409) ; `null` pour une erreur inattendue, à laisser remonter en 500.

**Conversations.** Utiliser `findOrCreateConversation(a, b)`, qui renvoie la conversation existante ou la crée.

**Auto-référence.** On ne peut pas se suivre, se bloquer, s'ajouter à son cercle proche ni s'acheter une compétence sur soi-même. La règle, comme les longueurs max et les minimums, est vérifiée par `lib/db/validation.ts` à chaque `create`, `createMany`, `update`, `updateMany` et `upsert`, mais pas dans les écritures imbriquées (`posts: { create: … }`).

**Réponses d'API.** Les documents Prisma ont déjà `id` et jamais `_id` ; `passwordHash` est omis de toutes les lectures (`omit: { passwordHash: false }` pour le lire à la connexion). Deux modèles ne s'envoient pas tels quels :

- `User` : renvoyer `toPublicUser(user)`, qui ne garde que le profil et ajoute `level` et `online`. Les champs privés (`email`, `role`, `points`, `totalEarned`, `streak`, `postsSeen`, `postsSeenToday`, `combo`, `timeSpentSec`, `lastActiveAt`) sont vendus par Clairvoyance. Pour le compte connecté, `toSelfJSON(user)` ;
- `Draw` : renvoyer `toDrawJSON(draw)`, qui masque la valeur des cases non grattées, `payout` et `prizeItemId` tant que le tirage est ouvert.

**Stories.** Créer avec `expiresAt: storyExpiry()` : Mongo la supprime 24 h après (index TTL).

**Tests.** Les tests de routes (`app/api`), de `lib/server` qui lisent la base et `lib/db/db.test.ts` forment le projet Vitest `db` : ils ne tournent que si `TEST_MONGODB_URI` est défini (le job `db` de la CI le fait). La base est vidée puis remplie avec la maquette avant chaque test : son nom doit finir par `_test`. Sans la variable, `pnpm test` ne lance que les tests unitaires.

```bash
docker compose up -d --wait
TEST_MONGODB_URI="mongodb://localhost:27017/detox_test?directConnection=true" pnpm test
```

**Production.** Après un push sur `main`, le job `prod` de la CI lance `pnpm db:indexes`, `pnpm db:seed` puis `pnpm db:smoke` sur la base du secret `MONGODB_URI_PROD` (environnement GitHub `production`). Les tests ne touchent jamais cette base.

**Jours.** `parisDay()` donne la date `AAAA-MM-JJ` à l'heure de Paris, pour la série de connexions et les gains du jour.
