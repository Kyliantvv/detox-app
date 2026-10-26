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
- **Qualité** : ESLint, Jest + Supertest, Swagger/OpenAPI
- **Lancement** : monorepo `frontend/` + `backend/`, `docker compose up` (mongo, backend, frontend)

## Lancer le projet

```bash
cp backend/.env.example backend/.env   # puis renseigner JWT_SECRET
docker compose up --build
```

- App : http://localhost:5173
- API : http://localhost:3000/api (santé : `GET /api/health`)
- Swagger : http://localhost:3000/api/docs

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
