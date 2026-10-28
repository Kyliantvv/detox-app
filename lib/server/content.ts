// Contenu du jeu utilisé à l'exécution (pas des données de démo : celles-ci sont dans scripts/scenario.ts).
import "server-only";
import type { Skill as DbSkill } from "../db";
import type { Skill, SkillId } from "../types";

// Comptes suivis d'office à l'inscription, s'ils existent (comptes de la maquette, `pnpm db:seed`).
export const DEFAULT_FOLLOWING = ["lina.m", "karim.zen", "ines.lofi", "noah.detox"];

// Premiers messages des comptes `bot`, par pseudo : le fil est amorcé à la première lecture.
export const STARTER_MESSAGES: Record<string, { from: "me" | "them"; text: string }[]> = {
  "karim.zen": [
    { from: "them", text: "T'as gratté ton ticket ?" },
    { from: "me", text: "Deux +200 et un 0. Pas mal." },
    { from: "them", text: "T'as vu mon ticket ? +200 ×2 encore" },
  ],
  "lina.m": [
    { from: "me", text: "Tu viens ce soir ?" },
    { from: "them", text: "Je fais une pause demain." },
  ],
  "ines.lofi": [{ from: "them", text: "Tu m'as espionnée ??" }],
  "noah.detox": [{ from: "them", text: "Ma série : 9 jours. La tienne ?" }],
};

export const AUTO_REPLIES = [
  "Attends, je finis ma page de Flow.",
  "Je te réponds un peu plus tard.",
  "Je suis en déplacement, je regarde ça ce soir.",
  "Tu as combien de points là ?",
  "On se voit ce week-end ?",
];

export const FAKE_ADDRESSES = [
  "12 rue de la République, 75011 Paris",
  "3 impasse des Lilas, 69003 Lyon",
  "8 allée des Chartrons, 33000 Bordeaux",
];

// Catalogue de la Clairvoyance : id du contrat d'API, compétence Prisma. Le prix vient de SKILLS (lib/db/skills.ts).
export const SKILL_CATALOG: (Omit<Skill, "price"> & { skill: DbSkill })[] = [
  { id: "derniere-connexion", skill: "last_seen", name: "Dernière connexion", shows: "Date de la dernière activité" },
  { id: "solde", skill: "balance", name: "Solde", shows: "Points actuels de la cible" },
  { id: "serie", skill: "streak", name: "Série", shows: "Jours de connexion consécutifs" },
  { id: "temps-scroll", skill: "scroll_time", name: "Temps de scroll", shows: "Pages de Flow lues aujourd'hui" },
  { id: "derniers-achats", skill: "recent_orders", name: "Derniers achats", shows: "Articles commandés à L'Épicerie" },
  { id: "visites-profil", skill: "profile_visits", name: "Visites de profil", shows: "Qui est passé voir qui" },
  { id: "plus-gros-gain", skill: "best_gain", name: "Plus gros gain", shows: "Meilleur gain en une action" },
  { id: "heures-pointe", skill: "peak_hours", name: "Heures de pointe", shows: "Créneaux où la cible est le plus active" },
  { id: "cercle-proche", skill: "close_circle", name: "Cercle proche", shows: "Comptes dans son cercle intime" },
  { id: "dossier-complet", skill: "full_dossier", name: "Dossier complet", shows: "Résumé des 9 précédentes" },
];

export const skillById = (id: string) => SKILL_CATALOG.find((skill) => skill.id === (id as SkillId));
