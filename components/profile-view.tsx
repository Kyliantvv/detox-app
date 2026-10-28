"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { useApi, useApiData, useMe } from "@/lib/api-client";
import type { PostView, PublicUser } from "@/lib/types";
import { BIO_MAX } from "@/lib/validation";
import Avatar from "./avatar";
import { BoltIcon, BookmarkIcon, ChevronRightIcon, EyeIcon, GridIcon, MenuIcon } from "./icons";
import { PostMedia } from "./post-card";

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  );
}

// Profil : le sien (username absent ou égal au sien) ou celui d'un autre compte.
export default function ProfileView({ username }: { username?: string }) {
  const { data: session } = useSession();
  const isMe = !username || username === session?.user.username;
  const { data: me } = useMe();
  const { data: other, error } = useApiData<{ user: PublicUser }>(
    isMe ? null : `/api/users/${encodeURIComponent(username)}`,
  );
  const profile = isMe ? me?.user : other?.user;

  if (error?.status === 404) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <p className="font-display text-lg font-bold">Compte introuvable.</p>
        <p className="text-sm text-muted">Ce compte s&apos;est peut-être vraiment détoxé.</p>
        <Link href="/recherche" className="btn-ghost">
          Chercher un compte
        </Link>
      </div>
    );
  }
  if (!profile) return <div className="h-40 animate-pulse rounded-2xl bg-panel" aria-label="Chargement du profil" />;
  return <Profile profile={profile} isMe={isMe} level={me?.stats.level} points={me?.stats.points} />;
}

function Profile({
  profile,
  isMe,
  level,
  points,
}: {
  profile: PublicUser;
  isMe: boolean;
  level?: number;
  points?: number;
}) {
  const api = useApi();
  const { mutate } = useSWRConfig();
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(profile.bio);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(Boolean(profile.followedByMe));

  const { data: posts } = useApiData<{ items: PostView[] }>(`/api/posts?author=${profile.id}`);
  const { data: saved } = useApiData<{ items: PostView[] }>(isMe && tab === "saved" ? "/api/posts?saved=1" : null);
  const shown = (isMe && tab === "saved" ? saved : posts)?.items ?? [];
  const profileKey = isMe ? "/api/me" : `/api/users/${encodeURIComponent(profile.username)}`;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const saveBio = async (event: FormEvent) => {
    event.preventDefault();
    await api.patch("/api/me", { bio: bio.trim() });
    await mutate("/api/me");
    setEditing(false);
  };

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    try {
      await (next ? api.post("/api/follows", { targetId: profile.id }) : api.del(`/api/follows/${profile.id}`));
      void mutate(profileKey);
      void mutate("/api/stories");
      void mutate("/api/feed/circle");
    } catch {
      setFollowing(!next);
    }
  };

  return (
    <>
      <header className="relative flex min-h-11 items-center justify-between">
        <h1 className="font-display text-xl font-bold">{profile.username}</h1>
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
                  onClick={() => signOut({ redirectTo: "/connexion" })}
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
        <Avatar name={profile.name} seed={profile.id} size={86} ring="pink" />
        <div className="flex flex-1 justify-around">
          <Stat value={posts?.items.length ?? "–"} label="Posts" />
          <Stat value={profile.followers} label="Abonnés" />
          <Stat value={profile.following} label="Suivis" />
        </div>
      </div>

      <div>
        <p className="font-semibold">{profile.name}</p>
        {editing ? (
          <form onSubmit={saveBio} className="mt-2 flex flex-col gap-2">
            <label htmlFor="bio" className="text-sm font-semibold text-muted">
              Bio
            </label>
            <textarea
              id="bio"
              className="input min-h-20 py-3"
              maxLength={BIO_MAX}
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
          <p className="text-[15px]">{profile.bio || (isMe ? "Jour 1 de ma détox numérique." : profile.status)}</p>
        )}
      </div>

      {isMe ? (
        <>
          <Link href="/epicerie" className="card flex items-center gap-3 px-4 py-3">
            <BoltIcon size={18} className="text-lime" />
            <span className="flex-1 font-semibold">
              Niveau {level ?? profile.level} · {(points ?? 0).toLocaleString("fr-FR")} pts
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
            onClick={toggleFollow}
            className={following ? "btn-ghost" : "btn-sun"}
            aria-pressed={following}
          >
            {following ? "Suivi" : "Suivre"}
          </button>
          <Link href={`/messages/${profile.id}`} className="btn-ghost">
            Message
          </Link>
          {profile.shielded ? (
            <span className="btn-ghost cursor-not-allowed text-muted" title="Bouclier actif">
              <EyeIcon size={18} /> Protégé
            </span>
          ) : (
            <Link href={`/epicerie/clairvoyance?cible=${profile.id}`} className="btn-ghost text-pink">
              <EyeIcon size={18} /> Espionner
            </Link>
          )}
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
          {shown.map((post) => (
            <div key={post.id} className="aspect-square overflow-hidden">
              <PostMedia post={post} />
            </div>
          ))}
        </div>
        {isMe && tab === "saved" && saved && shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Rien d&apos;enregistré. Touche le marque-page sous un post pour le garder ici.
          </p>
        )}
        {tab === "posts" && posts && shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {isMe ? "Aucun post. Publie ton premier Instant de détox." : "Aucun post pour l'instant."}
          </p>
        )}
      </div>
    </>
  );
}
