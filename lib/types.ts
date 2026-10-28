export type ArtVariant =
  | "sunset"
  | "moon"
  | "triangle"
  | "diamond"
  | "pill"
  | "ring"
  | "square"
  | "dome"
  | "dot"
  | "waves";

export type Post = {
  id: string;
  authorId: string;
  location: string;
  ago: string;
  art: ArtVariant;
  caption: string;
  doses: number;
  comments: { author: string; text: string }[];
  isReel?: boolean;
  imageUrl?: string;
};

export type ShopItemId = "sucre" | "ticket" | "lootbox" | "cigarettes";

export type ShopItem = {
  id: ShopItemId;
  name: string;
  price: number;
  description: string;
  kind: "order" | "ticket" | "lootbox";
};

export type SkillId =
  | "derniere-connexion"
  | "solde"
  | "serie"
  | "temps-scroll"
  | "derniers-achats"
  | "visites-profil"
  | "plus-gros-gain"
  | "heures-pointe"
  | "cercle-proche"
  | "dossier-complet";

export type Skill = {
  id: SkillId;
  name: string;
  shows: string;
  price: number;
};

export type Order = {
  id: string;
  itemId: ShopItemId;
  itemName: string;
  price: number;
  tracking: string;
  address: string;
  at: number;
};

// Étape du suivi de colis : `at` à null pour la livraison, sans date prévue.
export type TrackingStep = { label: string; at: number | null; done: boolean };

export type OrderDetail = Order & { steps: TrackingStep[] };

export type PointEvent = {
  id: string;
  amount: number;
  label: string;
  at: number;
};

export type ChatMessage = {
  id: string;
  from: "me" | "them";
  text: string;
  at: number;
};

export type Ticket = {
  cells: number[];
  revealed: boolean[];
  paidOut: boolean;
};

export type IntelKey = Exclude<SkillId, "dossier-complet">;

// ---------- Réponses de l'API (partagées entre lib/server/views.ts et le front) ----------

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  bio: string;
  status: string;
  level: number;
  hasInstant: boolean;
  shielded: boolean;
  followers: number;
  following: number;
  followedByMe?: boolean;
};

export type Me = PublicUser & { email: string };

export type Stats = {
  points: number;
  totalEarned: number;
  totalSpent: number;
  bestGain: number;
  earnedToday: number;
  streak: number;
  serenity: number;
  level: number;
  flowPagesRead: number;
  dosesGiven: number;
  orders: number;
  friendsSpied: number;
  timeSpentMs: number;
  events: PointEvent[];
};

export type PostAuthor = { id: string; username: string; name: string };

export type PostView = Post & {
  author: PostAuthor | null;
  dosedByMe: boolean;
  savedByMe: boolean;
  videoUrl?: string;
  // Flow et Reels : pourquoi l'algorithme de recommandation a choisi ce post.
  reason?: string;
};

export type ExploreTile = { id: string; art: ArtVariant; tags: string[] };

export type StoryItem = PostAuthor & { instant: { art: ArtVariant; text: string; ago: string } | null };

export type TicketView = {
  cells: (number | null)[];
  revealed: boolean[];
  paidOut: boolean;
  winnings: number | null;
};

export type ConversationItem = {
  id: string;
  user: PostAuthor;
  preview: string;
  fromMe: boolean;
  ago: string;
  at: number;
  unread: boolean;
};

export type SkillView = Skill & { owned: boolean };

// Toute action qui touche aux points renvoie le nouveau solde et les gains à afficher.
export type PointsResponse = { points: number; gains: PointEvent[] };

export type Purchase =
  | { kind: "order"; order: Order }
  | { kind: "ticket"; ticket: TicketView }
  | { kind: "lootbox"; prize: string };

export type ApiErrorBody = { error: { code: string; message: string } };
