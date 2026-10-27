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
| `User` | users | Compte, profil, solde de points, série de connexions |
| `Post` | posts | Photo ou reel, légende, tags, compteurs de likes et commentaires |
| `Like` | likes | Bonne dose : un par couple (utilisateur, post) |
| `Save` | saves | Post enregistré |
| `Comment` | comments | Commentaire, 500 caractères max |
| `Follow` | follows | Abonnement ; `closeFriend` pour les amis proches |
| `Block` | blocks | Blocage |
| `Story` | stories | Instant ; supprimé par Mongo 24 h après (index TTL) |
| `Conversation` | conversations | Deux participants, une seule conversation par paire |
| `Message` | messages | Message, `readAt` à la lecture |
| `ProfileView` | profileviews | Visite de profil (compétence Clairvoyance) |
| `PointEvent` | pointevents | Journal de chaque gain et dépense de points |
| `ShopItem` | shopitems | Article de L'Épicerie |
| `Order` | orders | Fausse commande avec faux suivi |
| `SkillPurchase` | skillpurchases | Compétence Clairvoyance achetée sur une cible |
| `Draw` | draws | Ticket à gratter, loot box ou bonus |

Le catalogue des 10 compétences n'est pas une collection : c'est la constante `SKILLS` dans `lib/db/models/skill-purchase.ts`.

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

- `creditPoints(userId, amount, type, { flowPage?, refId?, session? })` : crédite et journalise dans une transaction. `amount` à 0 ne fait rien (tirage perdant). Lève `NotFoundError` si l'utilisateur n'existe pas. Pour une page de Flow, `flowPage` est obligatoire et une même page ne rapporte qu'une fois (l'erreur E11000 signale le doublon).
- `spendPoints(userId, amount, type, { refId?, session? })` : renvoie `false` si le solde est insuffisant ; sinon débite et journalise. Le débit est conditionnel (`points >= amount`), donc deux achats simultanés ne peuvent pas faire passer le solde sous 0.

Un achat (compétence, commande, tirage) doit débiter et créer son document dans la même transaction, sinon un échec après le débit fait perdre les points. Passer la session :

```ts
await mongoose.connection.transaction(async (session) => {
  if (!(await spendPoints(userId, price, "skill_purchase", { session }))) throw new Error("Solde insuffisant");
  await SkillPurchase.create([{ buyerId: userId, targetId, skill, price }], { session });
});
```

Si la compétence est déjà achetée, l'index unique fait échouer `create` et le débit est annulé.

Les transactions demandent un replica set : Atlas en fournit un, même en M0. Un `mongod` local seul ne suffit pas.

**Likes et commentaires.** Utiliser `likePost`, `unlikePost`, `addComment` et `removeComment`. Ils écrivent le like ou le commentaire et le compteur dans une transaction, ne modifient le compteur que si le like ou le commentaire a vraiment été créé ou supprimé, et lèvent `NotFoundError` si le post n'existe pas.

**Conversations.** Utiliser `findOrCreateConversation(a, b)`, qui renvoie la conversation existante ou la crée.

**Auto-référence.** On ne peut pas se suivre, se bloquer ni s'acheter une compétence sur soi-même. La règle est vérifiée par `create()`/`save()`, pas par les upserts : créer ces documents avec `create()`.

**Réponses d'API.** Envoyer les documents Mongoose : `toJSON` retire `_id`, `__v` et `passwordHash`, et masque en plus :

- sur `User`, les champs privés (`email`, `points`, `totalEarned`, `streak`, `postsSeen`, `lastActiveAt`), puisque Clairvoyance les vend. Pour le compte connecté, renvoyer `toSelfJSON(user)` ;
- sur `Draw`, la valeur des cases non grattées et `payout` tant que le tirage est ouvert.

 Une requête `.lean()` renvoie le document brut : ne pas l'envoyer tel quel au client. `passwordHash` n'est jamais lu sans `.select("+passwordHash")`.

**Jours.** `parisDay()` donne la date `AAAA-MM-JJ` à l'heure de Paris, pour la série de connexions et les gains du jour.
