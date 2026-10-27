"use client";

// État de démo du front, gardé dans le navigateur (localStorage).
// Côté produit, tout ceci est calculé par le serveur : chaque fonction indique la route API
// qui la remplacera une fois le back branché. Le front ne fixe jamais un montant de points en prod.
import { useSyncExternalStore } from "react";
import {
  AUTO_REPLIES,
  DEMO_USER,
  FAKE_ADDRESSES,
  SHOP_ITEMS,
  SKILLS,
  STARTER_MESSAGES,
} from "./mock-data";
import type {
  ChatMessage,
  Order,
  Post,
  PointEvent,
  ShopItemId,
  SkillId,
  Ticket,
  User,
} from "./types";

export const POINTS = {
  flowPage: 10,
  dose: 2,
  reaction: 5,
  dailyLogin: 25,
  chest: 50,
  welcome: 500,
} as const;

export const TICKET_PRICE = 300;
const CHEST_EVERY_PAGES = 4;
const COMBO_WINDOW_MS = 5000;
const STORAGE_KEY = "detox-demo-v1";

export type DetoxState = {
  hydrated: boolean;
  user: User | null;
  account: User | null;
  points: number;
  totalEarned: number;
  totalSpent: number;
  bestGain: number;
  streak: number;
  lastLoginDay: string | null;
  serenity: number;
  sessionStartedAt: number | null;
  timeSpentMs: number;
  flowPagesRead: number[];
  earnedToday: number;
  dosedPostIds: string[];
  savedPostIds: string[];
  comments: Record<string, { author: string; text: string }[]>;
  following: string[];
  orders: Order[];
  skills: Record<string, SkillId[]>;
  ticket: Ticket | null;
  messages: Record<string, ChatMessage[]>;
  events: PointEvent[];
  combo: { count: number; lastAt: number };
  lastGain: PointEvent | null;
  publishedPosts: Post[];
};

const INITIAL: DetoxState = {
  hydrated: false,
  user: null,
  account: null,
  points: 0,
  totalEarned: 0,
  totalSpent: 0,
  bestGain: 0,
  streak: 0,
  lastLoginDay: null,
  serenity: 100,
  sessionStartedAt: null,
  timeSpentMs: 0,
  flowPagesRead: [],
  earnedToday: 0,
  dosedPostIds: [],
  savedPostIds: [],
  comments: {},
  following: ["lina", "karim", "ines", "noah"],
  orders: [],
  skills: {},
  ticket: null,
  messages: {},
  events: [],
  combo: { count: 0, lastAt: 0 },
  lastGain: null,
  publishedPosts: [],
};

let state: DetoxState = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    state = { ...INITIAL, ...(saved ? JSON.parse(saved) : {}), hydrated: true, lastGain: null };
  } catch {
    state = { ...INITIAL, hydrated: true };
  }
}

function persist() {
  try {
    // Les posts publiés pointent vers des URL blob locales : on ne les garde pas.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, hydrated: undefined, lastGain: undefined, publishedPosts: undefined }),
    );
  } catch {
    // Stockage indisponible (navigation privée) : la démo continue en mémoire.
  }
}

function setState(update: Partial<DetoxState> | ((prev: DetoxState) => Partial<DetoxState>)) {
  load();
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  load();
  return state;
}

const getServerSnapshot = () => INITIAL;

export function useDetox() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const levelFor = (totalEarned: number) => 1 + Math.floor(totalEarned / 250);

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Points (TODO API : écrits par le serveur sous forme de PointEvent) ----------

function credit(amount: number, label: string, { combo = false } = {}) {
  setState((prev) => {
    const now = Date.now();
    let comboState = prev.combo;
    let finalAmount = amount;
    let finalLabel = label;
    if (combo) {
      const count = now - prev.combo.lastAt < COMBO_WINDOW_MS ? prev.combo.count + 1 : 1;
      comboState = { count, lastAt: now };
      const multiplier = Math.min(3, 1 + Math.floor(count / 5) * 0.5);
      if (multiplier > 1) {
        finalAmount = Math.round(amount * multiplier);
        finalLabel = `${label} · combo ×${multiplier}`;
      }
    }
    const event: PointEvent = { id: uid(), amount: finalAmount, label: finalLabel, at: now };
    return {
      points: prev.points + finalAmount,
      totalEarned: prev.totalEarned + finalAmount,
      earnedToday: prev.earnedToday + finalAmount,
      bestGain: Math.max(prev.bestGain, finalAmount),
      combo: comboState,
      events: [event, ...prev.events].slice(0, 60),
      lastGain: event,
    };
  });
}

// Débit atomique côté serveur ($inc avec condition de solde) : ici, simple vérification.
function debit(amount: number, label: string): boolean {
  if (getSnapshot().points < amount) return false;
  setState((prev) => ({
    points: prev.points - amount,
    totalSpent: prev.totalSpent + amount,
    events: [{ id: uid(), amount: -amount, label, at: Date.now() }, ...prev.events].slice(0, 60),
  }));
  return true;
}

// ---------- Compte (TODO API : POST /api/auth/register, POST /api/auth/login) ----------

function startSession(user: User, firstTime: boolean) {
  const prev = getSnapshot();
  const day = today();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const newDay = prev.lastLoginDay !== day;
  setState({
    user,
    account: user,
    sessionStartedAt: Date.now(),
    lastLoginDay: day,
    streak: newDay ? (prev.lastLoginDay === yesterday ? prev.streak + 1 : 1) : prev.streak,
    earnedToday: newDay ? 0 : prev.earnedToday,
  });
  if (firstTime) credit(POINTS.welcome, "Cadeau de bienvenue");
  if (newDay) credit(POINTS.dailyLogin, "Connexion du jour");
}

export function register(user: User): string | null {
  const { account } = getSnapshot();
  if (account?.email === user.email) return "Cet e-mail est déjà utilisé.";
  setState({ ...INITIAL, hydrated: true });
  startSession(user, true);
  return null;
}

export function login(email: string): string | null {
  const { account } = getSnapshot();
  if (!account || account.email !== email.toLowerCase()) {
    return "Aucun compte avec cet e-mail sur cet appareil. Crée un compte ou utilise le compte démo.";
  }
  startSession(account, false);
  return null;
}

export function loginDemo() {
  const { account } = getSnapshot();
  const isDemo = account?.email === DEMO_USER.email;
  if (!isDemo) setState({ ...INITIAL, hydrated: true });
  startSession(DEMO_USER, !isDemo);
  if (!isDemo) {
    setState({ streak: 6 });
    credit(1955, "Points des jours précédents");
  }
}

export function logout() {
  const { sessionStartedAt, timeSpentMs } = getSnapshot();
  setState({
    user: null,
    sessionStartedAt: null,
    timeSpentMs: timeSpentMs + (sessionStartedAt ? Date.now() - sessionStartedAt : 0),
  });
}

export function updateBio(bio: string) {
  setState((prev) => (prev.user ? { user: { ...prev.user, bio }, account: { ...prev.user, bio } } : {}));
}

// ---------- Flow et interactions (TODO API : /api/feed/flow?page=N, /api/posts/:id/likes…) ----------

export function readFlowPage(page: number) {
  const prev = getSnapshot();
  if (prev.flowPagesRead.includes(page)) return;
  const pagesRead = [...prev.flowPagesRead, page];
  setState({ flowPagesRead: pagesRead, serenity: Math.max(0, prev.serenity - 3) });
  credit(POINTS.flowPage, `Page ${page + 1} du Flow`, { combo: true });
  if (pagesRead.length % CHEST_EVERY_PAGES === 0) credit(POINTS.chest, "Coffre ouvert");
  if (Math.random() < 0.15) credit(10 + Math.floor(Math.random() * 15) * 10, "Bonus aléatoire");
}

export function toggleDose(postId: string) {
  const prev = getSnapshot();
  if (prev.dosedPostIds.includes(postId)) {
    setState({ dosedPostIds: prev.dosedPostIds.filter((id) => id !== postId) });
    return;
  }
  setState({ dosedPostIds: [...prev.dosedPostIds, postId], serenity: Math.max(0, prev.serenity - 1) });
  credit(POINTS.dose, "Bonne dose donnée", { combo: true });
}

export function toggleSave(postId: string) {
  setState((prev) => ({
    savedPostIds: prev.savedPostIds.includes(postId)
      ? prev.savedPostIds.filter((id) => id !== postId)
      : [...prev.savedPostIds, postId],
  }));
}

export function addComment(postId: string, text: string) {
  const { user } = getSnapshot();
  if (!user) return;
  setState((prev) => ({
    comments: {
      ...prev.comments,
      [postId]: [...(prev.comments[postId] ?? []), { author: user.username, text }],
    },
  }));
  credit(POINTS.reaction, "Réaction", { combo: true });
}

export function toggleFollow(friendId: string) {
  setState((prev) => ({
    following: prev.following.includes(friendId)
      ? prev.following.filter((id) => id !== friendId)
      : [...prev.following, friendId],
  }));
}

// TODO API : POST /api/posts (multipart, champ « media »).
export function publishPost(post: Post) {
  setState((prev) => ({ publishedPosts: [post, ...prev.publishedPosts] }));
  credit(POINTS.reaction, "Publication");
}

// ---------- L'Épicerie (TODO API : GET /api/shop, POST /api/orders, POST /api/dice) ----------

export type PurchaseResult =
  | { ok: false; reason: string }
  | { ok: true; kind: "order"; order: Order }
  | { ok: true; kind: "ticket" }
  | { ok: true; kind: "lootbox"; prize: string };

const LOOT_PRIZES = [
  { label: "+1 000 pts", points: 1000 },
  { label: "+250 pts", points: 250 },
  { label: "+100 pts", points: 100 },
  { label: "Un sachet de sucre", item: "sucre" as const },
  { label: "Un ticket à gratter", item: "ticket" as const },
  { label: "Rien. Mais quelle émotion.", points: 0 },
];

function createOrder(itemId: ShopItemId): Order {
  const item = SHOP_ITEMS.find((shopItem) => shopItem.id === itemId)!;
  const order: Order = {
    id: uid(),
    itemId,
    itemName: item.name,
    price: item.price,
    tracking: `DTX-${Math.floor(100000 + Math.random() * 900000)}-FR`,
    address: FAKE_ADDRESSES[Math.floor(Math.random() * FAKE_ADDRESSES.length)],
    at: Date.now(),
  };
  setState((prev) => ({ orders: [order, ...prev.orders] }));
  return order;
}

export function buyItem(itemId: ShopItemId): PurchaseResult {
  const item = SHOP_ITEMS.find((shopItem) => shopItem.id === itemId)!;
  if (!debit(item.price, `Achat : ${item.name}`)) {
    return { ok: false, reason: `Il te manque ${item.price - getSnapshot().points} pts. Retourne scroller.` };
  }
  if (item.kind === "ticket") {
    drawTicket();
    return { ok: true, kind: "ticket" };
  }
  if (item.kind === "lootbox") {
    const prize = LOOT_PRIZES[Math.floor(Math.random() * LOOT_PRIZES.length)];
    if (prize.points) credit(prize.points, "Loot box");
    if (prize.item === "sucre") createOrder("sucre");
    if (prize.item === "ticket") drawTicket();
    return { ok: true, kind: "lootbox", prize: prize.label };
  }
  return { ok: true, kind: "order", order: createOrder(itemId) };
}

// Tirage « presque gagnant » : souvent deux valeurs identiques, rarement trois.
function drawTicket() {
  const values = [0, 50, 100, 200, 500, 1000];
  const pick = () => values[Math.floor(Math.random() * values.length)];
  const teaser = [200, 500, 1000][Math.floor(Math.random() * 3)];
  const cells = [teaser, teaser, pick(), pick(), pick(), Math.random() < 0.12 ? teaser : pick()];
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  setState({ ticket: { cells, revealed: cells.map(() => false), paidOut: false } });
}

export function buyTicket(): PurchaseResult {
  return buyItem("ticket");
}

export function ticketWinnings(ticket: Ticket): number {
  const counts = new Map<number, number>();
  ticket.cells.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Math.max(0, ...[...counts].filter(([, count]) => count >= 3).map(([value]) => value));
}

export function scratchCell(index: number) {
  const { ticket } = getSnapshot();
  if (!ticket || ticket.revealed[index]) return;
  const revealed = ticket.revealed.map((value, i) => value || i === index);
  const done = revealed.every(Boolean);
  setState({ ticket: { ...ticket, revealed, paidOut: done } });
  if (done && !ticket.paidOut) {
    const win = ticketWinnings(ticket);
    if (win > 0) credit(win, "Ticket gagnant");
  }
}

// ---------- Clairvoyance (TODO API : POST /api/skills/:skillId { targetId }) ----------

export function buySkill(friendId: string, skillId: SkillId): string | null {
  const owned = getSnapshot().skills[friendId] ?? [];
  if (owned.includes(skillId)) return null;
  const skill = SKILLS.find((s) => s.id === skillId)!;
  if (!debit(skill.price, `Clairvoyance : ${skill.name}`)) {
    return `Il te manque ${skill.price - getSnapshot().points} pts.`;
  }
  const unlocked = skillId === "dossier-complet" ? SKILLS.map((s) => s.id) : [...owned, skillId];
  setState((prev) => ({ skills: { ...prev.skills, [friendId]: unlocked } }));
  return null;
}

// ---------- Messages (TODO API : /api/conversations/:id/messages, en polling) ----------

export function messagesFor(state: DetoxState, conversationId: string): ChatMessage[] {
  return (
    state.messages[conversationId] ??
    (STARTER_MESSAGES[conversationId] ?? []).map((message, index) => ({
      ...message,
      id: `starter-${index}`,
      at: 0,
    }))
  );
}

export function sendMessage(conversationId: string, text: string) {
  const append = (message: ChatMessage) =>
    setState((prev) => ({
      messages: { ...prev.messages, [conversationId]: [...messagesFor(prev, conversationId), message] },
    }));
  append({ id: uid(), from: "me", text, at: Date.now() });
  window.setTimeout(() => {
    append({
      id: uid(),
      from: "them",
      text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
      at: Date.now(),
    });
  }, 1400);
}
