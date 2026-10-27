# Base de données

MongoDB Atlas, via Mongoose 9. Le code vit dans `lib/db/` ; le modèle conceptuel est dans [merise.md](merise.md).

## Mise en route

1. Dans Atlas : créer un cluster (le palier gratuit M0 suffit), un utilisateur de base, et autoriser son IP dans *Network Access*.
2. *Database > Connect > Drivers* : copier la chaîne de connexion.
3. `cp .env.example .env.local`, puis coller la chaîne dans `MONGODB_URI` en ajoutant le nom de base (`/detox`) avant le `?`.
4. Créer les index puis remplir la boutique :

   ```bash
   pnpm db:indexes
   pnpm db:seed
   ```

Node 22.9 ou plus récent (`.nvmrc`) : les scripts utilisent `--env-file-if-exists`.

| Script | Effet |
|---|---|
| `pnpm db:indexes` | Crée les index déclarés dans les schémas. N'en supprime aucun. Code de sortie 1 si un index échoue. À relancer après chaque ajout d'index. |
| `pnpm db:seed` | Crée ou met à jour les 4 articles de L'Épicerie. Relançable sans doublon. |

En dev, Mongoose crée les index au démarrage. En production (`NODE_ENV=production`), `connectDb()` n'en crée aucun et refuse de se connecter s'il en manque : lancer `pnpm db:indexes` avant de déployer. Les index uniques portent des règles métier (une page de Flow créditée une fois, un like par post, une conversation par paire), d'où ce blocage.

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
| `CloseFriend` | closefriends | Cercle proche de `ownerId` : qui voit ses posts `closeFriends` |
| `Block` | blocks | Blocage |
| `Story` | stories | Instant ; supprimé par Mongo 24 h après (index TTL) |
| `Conversation` | conversations | Deux participants, une seule conversation par paire |
| `Message` | messages | Message, `readAt` à la lecture |
| `ProfileView` | profileviews | Visite de profil (compétence Clairvoyance) |
| `PointEvent` | pointevents | Journal de chaque gain et dépense de points |
| `ShopItem` | shopitems | Article de L'Épicerie |
| `Order` | orders | Fausse commande avec faux suivi |
| `SkillPurchase` | skillpurchases | Compétence Clairvoyance achetée sur une cible |
| `Draw` | draws | Ticket à gratter, loot box ou bonus (`DiceRoll` dans le dossier) ; `prizeItemId` pour l'objet d'une loot box |

Le catalogue des 10 compétences n'est pas une collection : c'est la constante `SKILLS` dans `lib/db/models/skill-purchase.ts`.

Valeurs calculées, pas stockées :

- **Niveau** : `levelFor(totalEarned)`. **En ligne** : `isOnline(lastActiveAt)`, activité il y a moins de 2 min. Les deux sont dans le JSON public de `User` (`level`, `online`).
- **Temps de scroll** (compétence 4) : `flowPagesToday(userId)`. **Sérénité** : `serenityFor(pages)`, 100 moins 5 par page lue dans la journée.
- **Coffre** : `postsUntilChest(postsSeen)`, un coffre tous les `CHEST_EVERY` (50) posts.
- **Derniers achats** (compétence 5) : les commandes sont dans `Order`, les tickets et loot box dans `Draw`. Lire les deux.

Les seuils (`CHEST_EVERY`, `COMBO_GAP_MS`, `IDLE_GAP_MS`, `SERENITY_LOSS_PER_PAGE`) sont dans `lib/db/activity.ts`, à régler en test.

## Utilisation

```ts
import { connectDb, Post } from "@/lib/db";

await connectDb();
const post = await Post.findById(id);
return Response.json(post); // toJSON : `id`, sans `_id` ni `__v`
```

`connectDb()` garde une seule connexion par process, y compris pendant le hot reload de `next dev`.

## Règles

Ces règles évitent des soldes et des compteurs faux. Les helpers de `lib/db` les appliquent déjà.

**Points.** Ne jamais écrire `users.points` à la main. Passer par :

- `creditPoints(userId, amount, type, { flowPage?, refId?, session? })` : crédite et journalise dans une transaction. `amount` à 0 ne fait rien (tirage perdant). Lève `NotFoundError` si l'utilisateur n'existe pas. Pour une page de Flow, `flowPage` est obligatoire et une même page ne rapporte qu'une fois ; la connexion quotidienne aussi n'est créditée qu'une fois par jour. Le doublon lève une erreur E11000 (`isDuplicateKey(err)`).
- `spendPoints(userId, amount, type, { refId?, session? })` : débite et journalise, ou lève `InsufficientPointsError` sans rien écrire. Le débit est conditionnel (`points >= amount`), donc deux achats simultanés ne peuvent pas faire passer le solde sous 0. Une perte (ticket perdant) passe par ici : `creditPoints` refuse les montants négatifs.

Un achat doit débiter et créer son document dans la même transaction, sinon un échec après le débit fait perdre les points. Pour Clairvoyance, `buySkill(buyerId, targetId, skill)` le fait déjà, au prix de `SKILLS` (le `price` d'un `SkillPurchase` est toujours imposé par `SKILLS`). Pour une commande ou un tirage, passer la session :

```ts
await mongoose.connection.transaction(async (session) => {
  const [order] = await Order.create([{ userId, itemId, item, fakeAddress, trackingNumber }], { session });
  await spendPoints(userId, item.price, "shop_purchase", { refId: order._id, session });
});
```

Si le document ne peut pas être créé (doublon, validation) ou si le solde ne suffit pas, toute la transaction est annulée.

Les transactions demandent un replica set : Atlas en fournit un, même en M0. Un `mongod` local seul ne suffit pas.

**Likes, republications et commentaires.** Utiliser `likePost`, `unlikePost`, `repostPost`, `unrepostPost`, `addComment` et `removeComment`. Ils écrivent le document et le compteur dans une transaction, ne modifient le compteur que si le document a vraiment été créé ou supprimé, et lèvent `NotFoundError` si le post n'existe pas.

**Activité.** Appeler `recordActivity(userId)` à chaque requête authentifiée : elle met à jour `lastActiveAt` (« Dernière connexion », « En ligne ») et le temps passé du Bilan. `bumpCombo(userId)` enregistre une action qui rapporte et renvoie la longueur du combo ; le multiplicateur reste à définir. `recordPostsSeen(userId, n)` compte les posts vus du Flow (total, jour, coffre).

**Erreurs.** Les helpers lèvent des `DbError` (`NotFoundError`, `InvalidInputError`, `InsufficientPointsError`) qui portent `code` et `status`. Un id mal formé donne `InvalidInputError` (400), pas une `CastError`. Dans une route, `toApiError(err)` renvoie `{ status, body }` au format du contrat (`{ error: { code, message } }`) pour ces erreurs, les `CastError` et `ValidationError` (400) et les doublons E11000 (409) ; `null` pour une erreur inattendue, à laisser remonter en 500.

**Conversations.** Utiliser `findOrCreateConversation(a, b)`, qui renvoie la conversation existante ou la crée.

**Auto-référence.** On ne peut pas se suivre, se bloquer, s'ajouter à son cercle proche ni s'acheter une compétence sur soi-même. La règle est vérifiée par `create()`/`save()`, pas par les upserts : créer ces documents avec `create()`.

**Réponses d'API.** Envoyer les documents Mongoose : `toJSON` retire `_id`, `__v` et `passwordHash`, et masque en plus :

- sur `User`, les champs privés (`email`, `role`, `points`, `totalEarned`, `streak`, `postsSeen`, `postsSeenToday`, `combo`, `timeSpentSec`, `lastActiveAt`), puisque Clairvoyance les vend. Le JSON public ajoute `level` et `online`. Pour le compte connecté, renvoyer `toSelfJSON(user)` ;
- sur `Draw`, la valeur des cases non grattées, `payout` et `prizeItemId` tant que le tirage est ouvert.

 Une requête `.lean()` renvoie le document brut : ne pas l'envoyer tel quel au client. `passwordHash` n'est jamais lu sans `.select("+passwordHash")`.

**Jours.** `parisDay()` donne la date `AAAA-MM-JJ` à l'heure de Paris, pour la série de connexions et les gains du jour.
