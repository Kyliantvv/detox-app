"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CIRCLE_POSTS, EXPLORE_TILES, flowPage } from "@/lib/mock-data";
import { levelFor, logout, toggleFollow, updateBio, useDetox } from "@/lib/store";
import type { ArtVariant, Friend } from "@/lib/types";
import Artwork from "./artwork";
import Avatar from "./avatar";
import { BoltIcon, BookmarkIcon, ChevronRightIcon, EyeIcon, GridIcon, MenuIcon } from "./icons";

const MY_ARTS: ArtVariant[] = ["moon", "dot", "triangle", "diamond", "pill", "ring"];

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  );
}

// Profil : le sien (friend absent) ou celui d'un autre compte.
// TODO API : GET /api/users/:username, GET /api/posts?author=, POST/DELETE /api/follows.
export default function ProfileView({ friend }: { friend?: Friend }) {
  const state = useDetox();
  const router = useRouter();
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(state.user?.bio ?? "");
  const [copied, setCopied] = useState(false);

  const isMe = !friend;
  const username = friend?.username ?? state.user?.username ?? "";
  const following = friend ? state.following.includes(friend.id) : false;

  const posts: ArtVariant[] = isMe
    ? [...state.publishedPosts.map((post) => post.art), ...MY_ARTS]
    : CIRCLE_POSTS.filter((post) => post.authorId === friend.id)
        .map((post) => post.art)
        .concat(EXPLORE_TILES.slice(0, 5).map((tile) => tile.art));
  const savedPosts = [...CIRCLE_POSTS, ...flowPage(0), ...flowPage(1)].filter((post) =>
    state.savedPostIds.includes(post.id),
  );

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${username}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const saveBio = (event: FormEvent) => {
    event.preventDefault();
    updateBio(bio.trim());
    setEditing(false);
  };

  return (
    <>
      <header className="relative flex min-h-11 items-center justify-between">
        <h1 className="font-display text-xl font-bold">{username}</h1>
        {isMe && (
          <>
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="p-1"
            >
              <MenuIcon size={26} />
            </button>
            {menuOpen && (
              <div className="card absolute top-12 right-0 z-20 flex w-52 flex-col p-1.5 shadow-2xl">
                <Link href="/bilan" className="rounded-lg px-3 py-2.5 hover:bg-panel-2">
                  Mon bilan
                </Link>
                <Link href="/epicerie/commandes" className="rounded-lg px-3 py-2.5 hover:bg-panel-2">
                  Mes commandes
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.replace("/connexion");
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-pink hover:bg-panel-2"
                >
                  Se déconnecter
                </button>
              </div>
            )}
          </>
        )}
      </header>

      <div className="flex items-center gap-4">
        <Avatar name={friend?.name ?? username} seed={friend?.id ?? username} size={86} ring="pink" />
        <div className="flex flex-1 justify-around">
          <Stat value={posts.length} label="Posts" />
          <Stat value={isMe ? 312 : 120 + (friend?.level ?? 0) * 17} label="Abonnés" />
          <Stat value={isMe ? state.following.length : 90 + (friend?.level ?? 0) * 5} label="Suivis" />
        </div>
      </div>

      <div>
        <p className="font-semibold">{friend?.name ?? username}</p>
        {editing ? (
          <form onSubmit={saveBio} className="mt-2 flex flex-col gap-2">
            <label htmlFor="bio" className="text-sm font-semibold text-muted">
              Bio
            </label>
            <textarea
              id="bio"
              className="input min-h-20 py-3"
              maxLength={160}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-lime flex-1">
                Enregistrer
              </button>
              <button type="button" className="btn-ghost flex-1" onClick={() => setEditing(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[15px]">
            {isMe ? state.user?.bio || "Jour 1 de ma détox numérique." : friend.status}
          </p>
        )}
      </div>

      {isMe ? (
        <>
          <Link href="/epicerie" className="card flex items-center gap-3 px-4 py-3">
            <BoltIcon size={18} className="text-lime" />
            <span className="flex-1 font-semibold">
              Niveau {levelFor(state.totalEarned)} · {state.points.toLocaleString("fr-FR")} pts
            </span>
            <span className="flex items-center text-sm text-muted">
              L&apos;Épicerie <ChevronRightIcon size={16} />
            </span>
          </Link>
          {!editing && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
                Modifier le profil
              </button>
              <button type="button" className="btn-ghost" onClick={share} aria-live="polite">
                {copied ? "Lien copié" : "Partager"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => toggleFollow(friend.id)}
            className={following ? "btn-ghost" : "btn-sun"}
            aria-pressed={following}
          >
            {following ? "Suivi" : "Suivre"}
          </button>
          <Link href={`/messages/${friend.id}`} className="btn-ghost">
            Message
          </Link>
          <Link href={`/epicerie/clairvoyance?cible=${friend.id}`} className="btn-ghost text-pink">
            <EyeIcon size={18} /> Espionner
          </Link>
        </div>
      )}

      <div className="-mx-4">
        {isMe && (
          <div role="tablist" className="grid grid-cols-2 border-b border-line">
            {(
              [
                ["posts", GridIcon, "Mes posts"],
                ["saved", BookmarkIcon, "Enregistrés"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-label={label}
                onClick={() => setTab(id)}
                className={`-mb-px grid place-items-center border-b-2 py-3 ${tab === id ? "border-fg text-fg" : "border-transparent text-muted"}`}
              >
                <Icon size={22} />
              </button>
            ))}
          </div>
        )}
        <div className="mt-0.5 grid grid-cols-3 gap-0.5">
          {(tab === "posts" || !isMe ? posts : savedPosts.map((post) => post.art)).map((art, index) => (
            <div key={`${art}-${index}`} className="aspect-square">
              <Artwork variant={art} />
            </div>
          ))}
        </div>
        {isMe && tab === "saved" && savedPosts.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Rien d&apos;enregistré. Touche le marque-page sous un post pour le garder ici.
          </p>
        )}
      </div>
    </>
  );
}
