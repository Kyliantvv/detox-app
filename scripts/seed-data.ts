import type { AvatarColor, PostType, Prisma, Visibility } from "@prisma/client";

// Faux utilisateurs et faux posts pour `pnpm db:seed`. Pur et déterministe :
// une même graine donne les mêmes données.

/** Domaine des comptes de seed : le seed supprime ces comptes, et eux seuls, avant de les recréer. */
export const SEED_EMAIL_DOMAIN = "seed.detox.local";

/** Mot de passe de tous les comptes de seed. */
export const SEED_PASSWORD = "detox1234";
// bcrypt (coût 10) de SEED_PASSWORD, calculé une fois : l'auth prévue utilise bcrypt.
const SEED_PASSWORD_HASH = "$2b$10$zDgTsHS1wi0YmFSzx1wks.MVgzF/k.yj3NEycJ2wbao9DTgTQSUwm";

const DAY_MS = 24 * 60 * 60 * 1000;

const FIRST_NAMES = [
  "Léa", "Hugo", "Chloé", "Lucas", "Manon", "Nathan", "Inès", "Enzo", "Camille", "Louis",
  "Sarah", "Gabriel", "Jade", "Raphaël", "Emma", "Arthur", "Lina", "Jules", "Zoé", "Adam",
  "Mila", "Noah", "Lou", "Théo", "Alice", "Yanis", "Rose", "Sacha", "Ambre", "Malo",
];
const LAST_NAMES = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
  "Simon", "Laurent", "Lefèvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
  "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Faure",
];
const BIOS = [
  "", "Je scrolle donc je suis.", "Accro au café et aux stories.", "Étudiant·e, fatigué·e.",
  "Ici pour les points.", "Détox ? Demain.", "Photos de chats et de couchers de soleil.",
  "Série en cours : ne pas casser.", "Je like tout, désolé·e.", "Lyon ↔ Paris",
];
const CAPTIONS = [
  "Encore un dimanche au soleil ☀️", "Vue imprenable ce matin", "Le meilleur brunch de la ville",
  "Petit tour en montagne", "Ça, c'est fait.", "Je ne m'en lasse pas", "Nouvelle coupe, qu'en dites-vous ?",
  "Throwback à cet été", "Séance de sport du jour 💪", "Coucher de soleil sans filtre",
  "Ma playlist du moment tourne en boucle", "Premier essai, soyez indulgents", "On refait le monde en terrasse",
  "Week-end loin des écrans (ou presque)", "Quelqu'un reconnaît l'endroit ?", "",
];
const TAGS = ["voyage", "food", "sport", "mode", "nature", "art", "musique", "chill", "ville", "animaux"];
const LOCATIONS = ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Nantes", "Toulouse", "Nice", "Annecy", "Biarritz"];
const AVATAR_COLORS: AvatarColor[] = ["pink", "yellow", "green", "purple", "grey"];

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (max: number) => Math.floor(next() * max);
  const pick = <T>(list: readonly T[]) => list[int(list.length)];
  const chance = (p: number) => next() < p;
  return { next, int, pick, chance };
}
export type Rng = ReturnType<typeof createRng>;

/** Sans accents ni caractères spéciaux, pour les pseudos et les e-mails. */
const slug = (s: string) => s.normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase();

export function fakeUsers(count: number, rng: Rng, now = new Date()): Prisma.UserCreateManyInput[] {
  return Array.from({ length: count }, (_, i) => {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    // L'index garantit l'unicité ; le pseudo reste sous les 30 caractères.
    const username = `${slug(first)}.${slug(last)}${i + 1}`;
    return {
      email: `${username}@${SEED_EMAIL_DOMAIN}`,
      username,
      passwordHash: SEED_PASSWORD_HASH,
      displayName: `${first} ${last}`,
      bio: rng.pick(BIOS),
      avatarColor: rng.pick(AVATAR_COLORS),
      // Inscrits entre 60 et 120 jours avant `now`.
      createdAt: new Date(now.getTime() - (60 + rng.int(60)) * DAY_MS),
    };
  });
}

/** Posts répartis au hasard entre `authorIds`, publiés sur les 60 derniers jours. */
export function fakePosts(count: number, authorIds: string[], rng: Rng, now = new Date()): Prisma.PostCreateManyInput[] {
  if (count > 0 && authorIds.length === 0) throw new Error("Pas d'auteur pour les posts");
  return Array.from({ length: count }, (_, i) => {
    const type: PostType = rng.chance(0.2) ? "reel" : "photo";
    const visibility: Visibility = rng.chance(0.1) ? "closeFriends" : "public";
    const tags = [...new Set(Array.from({ length: rng.int(3) }, () => rng.pick(TAGS)))];
    return {
      authorId: rng.pick(authorIds),
      type,
      // Chemins fictifs : aucun fichier n'est envoyé sur UploadThing.
      mediaPath: `seed/${type}-${(i % 50) + 1}.${type === "reel" ? "mp4" : "jpg"}`,
      mediaMime: type === "reel" ? "video/mp4" : "image/jpeg",
      caption: rng.pick(CAPTIONS),
      location: rng.chance(0.5) ? rng.pick(LOCATIONS) : undefined,
      tags,
      visibility,
      createdAt: new Date(now.getTime() - rng.int(60 * DAY_MS)),
    };
  });
}
