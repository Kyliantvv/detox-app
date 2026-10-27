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

export type Friend = {
  id: string;
  username: string;
  name: string;
  status: string;
  level: number;
  hasInstant: boolean;
  shielded?: boolean;
};

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

export type User = {
  email: string;
  username: string;
  bio: string;
};
