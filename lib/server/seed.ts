// Données de départ de la DB mockée (lib/server/db.ts). Jamais importées par le front.
import "server-only";
import type { ArtVariant, Friend, Post, ShopItem, Skill, SkillId } from "../types";

export const FRIENDS: Friend[] = [
  { id: "lina", username: "lina.m", name: "Lina", status: "En ligne", level: 12, hasInstant: true },
  { id: "karim", username: "karim.zen", name: "Karim", status: "Connecté il y a 4 min", level: 18, hasInstant: true },
  { id: "ines", username: "ines.lofi", name: "Inès", status: "Connectée il y a 1 h", level: 7, hasInstant: true },
  { id: "sam", username: "sam.off", name: "Sam", status: "Bouclier actif · 5 h 12", level: 4, hasInstant: false, shielded: true },
  { id: "noah", username: "noah.detox", name: "Noah", status: "Connecté hier", level: 9, hasInstant: false },
];

// Instants (stories 24 h) en cours des comptes seedés.
export const INSTANTS: Record<string, { art: ArtVariant; text: string; agoMs: number }> = {
  lina: { art: "sunset", text: "Coucher de soleil. Je ne l'ai pas regardé, je l'ai filmé.", agoMs: 2 * 3_600_000 },
  karim: { art: "ring", text: "14 jours de série. Je ne sens plus mon pouce.", agoMs: 40 * 60_000 },
  ines: { art: "dome", text: "Pause déj = pause scroll. Ou l'inverse.", agoMs: 3 * 3_600_000 },
};

export const CIRCLE_POSTS: Post[] = [
  {
    id: "c1",
    authorId: "lina",
    location: "Quiberon",
    ago: "il y a 3 min",
    art: "sunset",
    caption: "Jour 6 sans lâcher l'appli. Je me sens très détendue.",
    doses: 1248,
    comments: [{ author: "karim.zen", text: "Pareil, j'ai oublié de dormir." }],
  },
  {
    id: "c2",
    authorId: "karim",
    location: "Lyon",
    ago: "il y a 22 min",
    art: "moon",
    caption: "Méditation guidée par mes notifications.",
    doses: 864,
    comments: [],
  },
  {
    id: "c3",
    authorId: "ines",
    location: "Nantes",
    ago: "il y a 1 h",
    art: "waves",
    caption: "Petite pause loin des écrans (photo prise depuis mon écran).",
    doses: 412,
    comments: [{ author: "lina.m", text: "Inspirant." }],
  },
  {
    id: "c4",
    authorId: "noah",
    location: "Paris",
    ago: "il y a 3 h",
    art: "diamond",
    caption: "J'ai gagné 300 pts en scrollant aux toilettes. Productif.",
    doses: 2031,
    comments: [],
  },
];

const FLOW_ARTS: ArtVariant[] = ["triangle", "ring", "square", "dome", "dot", "pill", "sunset", "moon", "diamond", "waves"];
const FLOW_CAPTIONS = [
  "Encore un. Juste un.",
  "Le scroll, c'est du cardio pour le pouce.",
  "Je ne sais plus pourquoi j'ai ouvert l'appli.",
  "Ma série tient bon. Moi moins.",
  "Contenu recommandé pour toi, parce que tu es resté.",
  "Il est 3 h du matin et tout va bien.",
  "Une Bonne dose et j'arrête. Promis.",
];
const FLOW_PLACES = ["Marseille", "Lille", "Bordeaux", "Rennes", "Toulouse", "Nice", "Brest"];
const FLOW_AUTHORS = ["lina", "karim", "ines", "noah", "sam"];

// Page N du Flow : déterministe, pour que le rendu serveur et client concordent.
export function flowPage(page: number, perPage = 5): Post[] {
  return Array.from({ length: perPage }, (_, index) => {
    const n = page * perPage + index;
    return {
      id: `f${n}`,
      authorId: FLOW_AUTHORS[n % FLOW_AUTHORS.length],
      location: FLOW_PLACES[(n * 3) % FLOW_PLACES.length],
      ago: `il y a ${(n % 50) + 2} min`,
      art: FLOW_ARTS[(n * 7) % FLOW_ARTS.length],
      caption: FLOW_CAPTIONS[(n * 5) % FLOW_CAPTIONS.length],
      doses: 120 + ((n * 389) % 4800),
      comments: [],
    };
  });
}

export const REELS: Post[] = [
  { id: "r1", authorId: "karim", location: "Lyon", ago: "il y a 8 min", art: "ring", caption: "POV : tu fermes l'appli (non).", doses: 5120, comments: [], isReel: true },
  { id: "r2", authorId: "lina", location: "Quiberon", ago: "il y a 1 h", art: "sunset", caption: "Coucher de soleil vu en 0,5 seconde.", doses: 9832, comments: [], isReel: true },
  { id: "r3", authorId: "ines", location: "Nantes", ago: "il y a 2 h", art: "dome", caption: "Routine bien-être : 6 h d'écran.", doses: 3307, comments: [], isReel: true },
  { id: "r4", authorId: "noah", location: "Paris", ago: "hier", art: "triangle", caption: "Tutoriel : scroller sans les mains.", doses: 12400, comments: [], isReel: true },
];

export const EXPLORE_TILES: { id: string; art: ArtVariant; tags: string[] }[] = [
  { id: "e1", art: "sunset", tags: ["Pour toi", "Voyage"] },
  { id: "e2", art: "dot", tags: ["Pour toi", "Tendances"] },
  { id: "e3", art: "triangle", tags: ["Pour toi", "Amis"] },
  { id: "e4", art: "diamond", tags: ["Pour toi", "Tendances"] },
  { id: "e5", art: "pill", tags: ["Pour toi", "Amis"] },
  { id: "e6", art: "ring", tags: ["Pour toi", "Voyage"] },
  { id: "e7", art: "triangle", tags: ["Tendances", "Voyage"] },
  { id: "e8", art: "square", tags: ["Pour toi", "Tendances"] },
  { id: "e9", art: "moon", tags: ["Pour toi", "Amis"] },
  { id: "e10", art: "dome", tags: ["Pour toi", "Voyage"] },
  { id: "e11", art: "waves", tags: ["Pour toi", "Tendances", "Voyage"] },
  { id: "e12", art: "dot", tags: ["Amis"] },
];

export const SHOP_ITEMS: ShopItem[] = [
  { id: "sucre", name: "Sachet de sucre", price: 150, description: "Un petit shoot de glucose. Livré nulle part.", kind: "order" },
  { id: "ticket", name: "Ticket à gratter", price: 300, description: "Gagne ou perds des points, au hasard.", kind: "ticket" },
  { id: "lootbox", name: "Loot box", price: 600, description: "Un objet ou un bonus tiré au sort.", kind: "lootbox" },
  { id: "cigarettes", name: "Paquet de cigarettes", price: 1000, description: "Fausse commande, fausse livraison, vraie ironie.", kind: "order" },
];

export const SKILLS: Skill[] = [
  { id: "derniere-connexion", name: "Dernière connexion", shows: "Date de la dernière activité", price: 100 },
  { id: "solde", name: "Solde", shows: "Points actuels de la cible", price: 150 },
  { id: "serie", name: "Série", shows: "Jours de connexion consécutifs", price: 150 },
  { id: "temps-scroll", name: "Temps de scroll", shows: "Pages de Flow lues aujourd'hui", price: 200 },
  { id: "derniers-achats", name: "Derniers achats", shows: "Articles commandés à L'Épicerie", price: 250 },
  { id: "visites-profil", name: "Visites de profil", shows: "Qui est passé voir qui", price: 250 },
  { id: "plus-gros-gain", name: "Plus gros gain", shows: "Meilleur gain en une action", price: 300 },
  { id: "heures-pointe", name: "Heures de pointe", shows: "Créneaux où la cible est le plus active", price: 350 },
  { id: "cercle-proche", name: "Cercle proche", shows: "Comptes dans son cercle intime", price: 400 },
  { id: "dossier-complet", name: "Dossier complet", shows: "Résumé des 9 précédentes", price: 800 },
];

// Ce que révèle chaque compétence, par ami. Métadonnées seulement, jamais le contenu des messages.
export const INTEL: Record<string, Record<Exclude<SkillId, "dossier-complet">, string>> = {
  lina: {
    "derniere-connexion": "À l'instant",
    solde: "1 870",
    serie: "6 jours",
    "temps-scroll": "38 pages",
    "derniers-achats": "Sachet de sucre (hier)",
    "visites-profil": "A visité Karim 14 fois",
    "plus-gros-gain": "+420 (ticket à gratter)",
    "heures-pointe": "23 h – 2 h",
    "cercle-proche": "3 comptes",
  },
  karim: {
    "derniere-connexion": "Il y a 4 min",
    solde: "3 120",
    serie: "14 jours",
    "temps-scroll": "112 pages",
    "derniers-achats": "Loot box (il y a 2 h), ticket ×3 (hier)",
    "visites-profil": "A visité ton profil 9 fois",
    "plus-gros-gain": "+1 000 (loot box)",
    "heures-pointe": "7 h – 8 h, 22 h – 1 h",
    "cercle-proche": "5 comptes",
  },
  ines: {
    "derniere-connexion": "Il y a 1 h",
    solde: "640",
    serie: "2 jours",
    "temps-scroll": "9 pages",
    "derniers-achats": "Aucun",
    "visites-profil": "A visité Lina 3 fois",
    "plus-gros-gain": "+50 (combo)",
    "heures-pointe": "12 h – 14 h",
    "cercle-proche": "1 compte",
  },
  sam: {
    "derniere-connexion": "Il y a 5 h",
    solde: "210",
    serie: "1 jour",
    "temps-scroll": "2 pages",
    "derniers-achats": "Paquet de cigarettes (lundi)",
    "visites-profil": "N'a visité personne",
    "plus-gros-gain": "+25 (connexion)",
    "heures-pointe": "18 h – 19 h",
    "cercle-proche": "0 compte",
  },
  noah: {
    "derniere-connexion": "Hier, 23 h 48",
    solde: "2 455",
    serie: "9 jours",
    "temps-scroll": "64 pages",
    "derniers-achats": "Ticket à gratter (hier)",
    "visites-profil": "A visité Inès 21 fois",
    "plus-gros-gain": "+300 (bonus aléatoire)",
    "heures-pointe": "3 h – 4 h",
    "cercle-proche": "2 comptes",
  },
};

export const STARTER_MESSAGES: Record<string, { from: "me" | "them"; text: string }[]> = {
  karim: [
    { from: "them", text: "T'as gratté ton ticket ?" },
    { from: "me", text: "Deux +200 et un 0. Comme d'hab." },
    { from: "them", text: "T'as vu mon ticket ? +200 ×2 encore" },
  ],
  lina: [
    { from: "me", text: "Tu viens ce soir ?" },
    { from: "them", text: "Je fais une pause demain. Ou après-demain." },
  ],
  ines: [{ from: "them", text: "Tu m'as espionnée ??" }],
  noah: [{ from: "them", text: "Ma série : 9 jours. La tienne ?" }],
};

export const AUTO_REPLIES = [
  "Attends, je finis ma page de Flow.",
  "Mdr. Je te réponds dans 3 scrolls.",
  "J'ai plus de batterie mais je reste.",
  "Tu as combien de points là ?",
  "On se voit en vrai ? (non)",
];

export const FAKE_ADDRESSES = [
  "12 rue de l'Attention Captée, 75000 Nulle-Part",
  "3 impasse du Scroll Infini, 69000 Ailleurs",
  "8 allée de la Dopamine, 33000 Jamais",
];

export const DEMO_USER = {
  email: "alex@detox.test",
  username: "alex.detox",
  bio: "Jour 6 de ma détox numérique. Je n'ai pas fermé l'appli depuis.",
};
