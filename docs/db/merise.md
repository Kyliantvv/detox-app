# Modèle de données (MERISE)

Trois niveaux, chacun coupé en deux domaines : **social** (comptes, publications, messages) et **économie** (points, boutique, Clairvoyance). Les diagrammes sont tirés de `lib/db/models/*.ts` ; si un modèle change, mettre à jour le diagramme ici.

GitHub et la plupart des éditeurs affichent les blocs Mermaid.

## Légende

| Signe | Sens |
|---|---|
| ★ | Identifiant (MCD), clé primaire (MLD), `_id` (MPD) |
| # | Clé étrangère (MLD) |
| 0,n / 1,1 | Cardinalité min,max, écrite côté entité (MCD) |
| (R) | Identification relative : CASE n'existe que dans son TIRAGE |
| ◆ | Donnée embarquée dans le document (MPD) |
| ▲ | Valeur dérivée stockée pour lire vite (MPD) |
| `unique()` `idx()` `ttl()` | Index MongoDB (MPD) |
| `<<association>>` | Association (MCD) |

Les attributs dérivés (soldes, compteurs) ne figurent pas au MCD : ils se calculent à partir des événements. Ils réapparaissent au MPD, marqués ▲.

## MCD

### Social

```mermaid
classDiagram
direction LR
class UTILISATEUR { ★idUtilisateur
  email
  username
  motDePasseHash
  nomAffiche
  bio
  avatar
  couleurAvatar
  derniereActivite
  dateInscription }
class PUBLICATION { ★idPublication
  type
  media
  typeMime
  legende
  lieu
  visibilite
  datePublication }
class TAG { ★libelle }
class COMMENTAIRE { ★idCommentaire
  texte
  dateCommentaire }
class INSTANT { ★idInstant
  media
  typeMime
  datePublication
  dateExpiration }
class CONVERSATION { ★idConversation
  dateCreation }
class MESSAGE { ★idMessage
  texte
  dateEnvoi
  dateLecture }
class VISITE { ★idVisite
  dateVisite }
class PUBLIER:::assoc { <<association>> }
class ETIQUETER:::assoc { <<association>> }
class AIMER:::assoc { <<association>>
  dateLike }
class ENREGISTRER:::assoc { <<association>>
  dateEnregistrement }
class ECRIRE:::assoc { <<association>> }
class CONCERNER:::assoc { <<association>> }
class SUIVRE:::assoc { <<association>>
  procheAmi
  dateSuivi }
class BLOQUER:::assoc { <<association>>
  dateBlocage }
class EFFECTUER:::assoc { <<association>> }
class VISER:::assoc { <<association>> }
class POSTER:::assoc { <<association>> }
class VOIR:::assoc { <<association>> }
class PARTICIPER:::assoc { <<association>> }
class ENVOYER:::assoc { <<association>> }
class CONTENIR:::assoc { <<association>> }
UTILISATEUR "0,n" -- PUBLIER
PUBLIER -- "1,1" PUBLICATION
PUBLICATION "0,n" -- ETIQUETER
ETIQUETER -- "0,n" TAG
UTILISATEUR "0,n" -- AIMER
AIMER -- "0,n" PUBLICATION
UTILISATEUR "0,n" -- ENREGISTRER
ENREGISTRER -- "0,n" PUBLICATION
UTILISATEUR "0,n" -- ECRIRE
ECRIRE -- "1,1" COMMENTAIRE
COMMENTAIRE "1,1" -- CONCERNER
CONCERNER -- "0,n" PUBLICATION
UTILISATEUR "0,n suiveur" -- SUIVRE
SUIVRE -- "0,n suivi" UTILISATEUR
UTILISATEUR "0,n bloqueur" -- BLOQUER
BLOQUER -- "0,n bloqué" UTILISATEUR
UTILISATEUR "0,n visiteur" -- EFFECTUER
EFFECTUER -- "1,1" VISITE
VISITE "1,1" -- VISER
VISER -- "0,n profil" UTILISATEUR
UTILISATEUR "0,n" -- POSTER
POSTER -- "1,1" INSTANT
UTILISATEUR "0,n" -- VOIR
VOIR -- "0,n" INSTANT
UTILISATEUR "0,n" -- PARTICIPER
PARTICIPER -- "2,2" CONVERSATION
UTILISATEUR "0,n" -- ENVOYER
ENVOYER -- "1,1" MESSAGE
CONVERSATION "0,n" -- CONTENIR
CONTENIR -- "1,1" MESSAGE
classDef assoc fill:#606060,stroke:#707070
```

### Économie

ACHETER est ternaire : un acheteur, une cible, une compétence.

```mermaid
classDiagram
direction LR
class UTILISATEUR { ★idUtilisateur
  … voir MCD social }
class EVENEMENT_POINTS { ★idEvenement
  montant
  type
  numeroPageFlow
  jour
  dateEvenement }
class ARTICLE { ★idArticle
  slug
  nom
  description
  icone
  prix
  nature
  actif }
class COMMANDE { ★idCommande
  prixPaye
  quantite
  adresseFictive
  numeroSuivi
  statut
  dateCommande }
class TIRAGE { ★idTirage
  nature
  cout
  gain
  statut
  dateTirage }
class CASE { ★position
  valeur
  revelee }
class COMPETENCE { ★code
  libelle
  prix }
class RECEVOIR:::assoc { <<association>> }
class PASSER:::assoc { <<association>> }
class PORTER_SUR:::assoc { <<association>> }
class JOUER:::assoc { <<association>> }
class COMPOSER:::assoc { <<association>> }
class ACHETER:::assoc { <<association ternaire>>
  prixPaye
  dateAchat }
UTILISATEUR "0,n" -- RECEVOIR
RECEVOIR -- "1,1" EVENEMENT_POINTS
UTILISATEUR "0,n" -- PASSER
PASSER -- "1,1" COMMANDE
COMMANDE "1,1" -- PORTER_SUR
PORTER_SUR -- "0,n" ARTICLE
UTILISATEUR "0,n" -- JOUER
JOUER -- "1,1" TIRAGE
TIRAGE "0,n" -- COMPOSER
COMPOSER -- "1,1 (R)" CASE
UTILISATEUR "0,n acheteur" -- ACHETER
ACHETER -- "0,n cible" UTILISATEUR
ACHETER -- "0,n" COMPETENCE
classDef assoc fill:#606060,stroke:#707070
```

## MLD

Règles de passage : une cardinalité 1,1 devient une clé étrangère côté entité ; une association n,n devient une table dont la clé primaire est la paire de clés étrangères.

### Social

```mermaid
classDiagram
direction LR
class UTILISATEUR { ★idUtilisateur
  email
  username
  motDePasseHash
  nomAffiche
  bio
  avatar
  couleurAvatar
  derniereActivite
  dateInscription }
class PUBLICATION { ★idPublication
  type
  media
  typeMime
  legende
  lieu
  visibilite
  datePublication
  #idAuteur }
class TAG { ★libelle }
class ETIQUETER { ★#idPublication
  ★#libelle }
class AIMER { ★#idUtilisateur
  ★#idPublication
  dateLike }
class ENREGISTRER { ★#idUtilisateur
  ★#idPublication
  dateEnregistrement }
class COMMENTAIRE { ★idCommentaire
  texte
  dateCommentaire
  #idAuteur
  #idPublication }
class SUIVRE { ★#idSuiveur
  ★#idSuivi
  procheAmi
  dateSuivi }
class BLOQUER { ★#idBloqueur
  ★#idBloque
  dateBlocage }
class VISITE { ★idVisite
  dateVisite
  #idVisiteur
  #idProfil }
class INSTANT { ★idInstant
  media
  typeMime
  datePublication
  dateExpiration
  #idAuteur }
class VOIR { ★#idUtilisateur
  ★#idInstant }
class CONVERSATION { ★idConversation
  dateCreation }
class PARTICIPER { ★#idUtilisateur
  ★#idConversation }
class MESSAGE { ★idMessage
  texte
  dateEnvoi
  dateLecture
  #idExpediteur
  #idConversation }
PUBLICATION --> UTILISATEUR
ETIQUETER --> PUBLICATION
ETIQUETER --> TAG
AIMER --> UTILISATEUR
AIMER --> PUBLICATION
ENREGISTRER --> UTILISATEUR
ENREGISTRER --> PUBLICATION
COMMENTAIRE --> UTILISATEUR
COMMENTAIRE --> PUBLICATION
SUIVRE --> UTILISATEUR : suiveur
SUIVRE --> UTILISATEUR : suivi
BLOQUER --> UTILISATEUR : bloqueur
BLOQUER --> UTILISATEUR : bloqué
VISITE --> UTILISATEUR : visiteur
VISITE --> UTILISATEUR : profil
INSTANT --> UTILISATEUR
VOIR --> UTILISATEUR
VOIR --> INSTANT
PARTICIPER --> UTILISATEUR
PARTICIPER --> CONVERSATION
MESSAGE --> UTILISATEUR
MESSAGE --> CONVERSATION
```

### Économie

```mermaid
classDiagram
direction LR
class UTILISATEUR { ★idUtilisateur
  … voir MLD social }
class EVENEMENT_POINTS { ★idEvenement
  montant
  type
  numeroPageFlow
  jour
  dateEvenement
  #idUtilisateur }
class ARTICLE { ★idArticle
  slug
  nom
  description
  icone
  prix
  nature
  actif }
class COMMANDE { ★idCommande
  prixPaye
  quantite
  adresseFictive
  numeroSuivi
  statut
  dateCommande
  #idUtilisateur
  #idArticle }
class TIRAGE { ★idTirage
  nature
  cout
  gain
  statut
  dateTirage
  #idUtilisateur }
class CASE { ★#idTirage
  ★position
  valeur
  revelee }
class COMPETENCE { ★code
  libelle
  prix }
class ACHETER { ★#idAcheteur
  ★#idCible
  ★#codeCompetence
  prixPaye
  dateAchat }
EVENEMENT_POINTS --> UTILISATEUR
COMMANDE --> UTILISATEUR
COMMANDE --> ARTICLE
TIRAGE --> UTILISATEUR
CASE --> TIRAGE
ACHETER --> UTILISATEUR : acheteur
ACHETER --> UTILISATEUR : cible
ACHETER --> COMPETENCE
```

## MPD (MongoDB)

Du MLD au MPD, six relations passent dans des documents :

| MLD | MPD | Pourquoi |
|---|---|---|
| TAG, ETIQUETER | `posts.tags[]` ◆ | Un tableau de chaînes indexé suffit pour la recherche |
| VOIR | `stories.viewerIds[]` ◆ | Lu à chaque affichage ; l'Instant disparaît en 24 h (TTL) |
| PARTICIPER | `conversations.participantIds[2]` ◆ + `pairKey` | Toujours 2 participants ; `pairKey` unique empêche les doublons |
| CASE | `draws.cells[]` ◆ | Les cases n'existent qu'à travers leur ticket |
| COMPETENCE | constante `SKILLS` | 10 lignes fixes, une collection n'apporte rien |
| COMMANDE → ARTICLE | `orders.item` ◆ `{name, price}` | Garde le nom et le prix au moment de l'achat |

Valeurs dérivées stockées (▲) :

| Source | Champ | Pourquoi |
|---|---|---|
| Σ EVENEMENT_POINTS | `users.points`, `totalEarned`, `streak`, `postsSeen` | Débit conditionnel sans recalculer l'historique |
| nombre de AIMER, COMMENTAIRE | `posts.likesCount`, `commentsCount` | Pas de comptage par post dans le fil |
| dernier MESSAGE | `conversations.lastMessageAt`, `lastMessagePreview` | Trie la liste des conversations sans jointure |

### Social

```mermaid
classDiagram
direction LR
class users { ★ObjectId _id
  String email
  String username
  String passwordHash
  String displayName
  String bio
  String avatarPath
  String avatarColor
  Number points ▲
  Number totalEarned ▲
  Object streak ▲
  Number postsSeen ▲
  Date lastActiveAt
  Date createdAt
  unique(email)
  unique(username) }
class posts { ★ObjectId _id
  ObjectId authorId
  String type
  String mediaPath
  String mediaMime
  String caption
  String location
  String[] tags ◆
  String visibility
  Number likesCount ▲
  Number commentsCount ▲
  Date createdAt
  idx(authorId, createdAt)
  idx(tags, createdAt) }
class likes { ★ObjectId _id
  ObjectId userId
  ObjectId postId
  Date createdAt
  unique(userId, postId) }
class saves { ★ObjectId _id
  ObjectId userId
  ObjectId postId
  Date createdAt
  unique(userId, postId) }
class comments { ★ObjectId _id
  ObjectId postId
  ObjectId authorId
  String text
  Date createdAt
  idx(postId, createdAt) }
class follows { ★ObjectId _id
  ObjectId followerId
  ObjectId followingId
  Boolean closeFriend
  Date createdAt
  unique(followerId, followingId) }
class blocks { ★ObjectId _id
  ObjectId blockerId
  ObjectId blockedId
  Date createdAt
  unique(blockerId, blockedId) }
class profileviews { ★ObjectId _id
  ObjectId viewerId
  ObjectId profileId
  Date createdAt
  idx(profileId, createdAt) }
class stories { ★ObjectId _id
  ObjectId authorId
  String mediaPath
  String mediaMime
  ObjectId[] viewerIds ◆
  Date expiresAt
  Date createdAt
  ttl(expiresAt) }
class conversations { ★ObjectId _id
  ObjectId[2] participantIds ◆
  String pairKey
  Date lastMessageAt ▲
  String lastMessagePreview ▲
  unique(pairKey) }
class messages { ★ObjectId _id
  ObjectId conversationId
  ObjectId senderId
  String text
  Date readAt
  Date createdAt
  idx(conversationId, createdAt) }
posts --> users : authorId
likes --> users : userId
likes --> posts : postId
saves --> users : userId
saves --> posts : postId
comments --> users : authorId
comments --> posts : postId
follows --> users : followerId
follows --> users : followingId
blocks --> users : blockerId
blocks --> users : blockedId
profileviews --> users : viewerId
profileviews --> users : profileId
stories --> users : authorId
stories --> users : viewerIds[]
conversations --> users : participantIds[]
messages --> conversations : conversationId
messages --> users : senderId
```

### Économie

```mermaid
classDiagram
direction LR
class users { ★ObjectId _id
  … voir MPD social }
class pointevents { ★ObjectId _id
  ObjectId userId
  Number amount
  String type
  Number flowPage
  ObjectId refId
  String day
  Date createdAt
  idx(userId, createdAt)
  idx(userId, day, type)
  unique(userId, flowPage) si type=flow_page }
class shopitems { ★ObjectId _id
  String slug
  String name
  String description
  String icon
  Number price
  String kind
  Boolean active
  unique(slug) }
class orders { ★ObjectId _id
  ObjectId userId
  ObjectId itemId
  Object item ◆ name, price
  Number quantity
  String fakeAddress
  String trackingNumber
  String status
  Date createdAt
  unique(trackingNumber)
  idx(userId, createdAt) }
class draws { ★ObjectId _id
  ObjectId userId
  String kind
  Number cost
  Object[] cells ◆ value, revealed
  Number payout
  String status
  Date createdAt
  idx(userId, status, createdAt) }
class skillpurchases { ★ObjectId _id
  ObjectId buyerId
  ObjectId targetId
  String skill
  Number price
  Date createdAt
  unique(buyerId, targetId, skill) }
class SKILLS:::code { <<constante TS, pas de collection>>
  last_seen 100
  balance 150
  streak 150
  scroll_time 200
  recent_orders 250
  profile_visits 250
  best_gain 300
  peak_hours 350
  close_circle 400
  full_dossier 800 }
pointevents --> users : userId
orders --> users : userId
orders --> shopitems : itemId
draws --> users : userId
skillpurchases --> users : buyerId
skillpurchases --> users : targetId
skillpurchases ..> SKILLS : skill
classDef code fill:#606060,stroke:#707070
```
