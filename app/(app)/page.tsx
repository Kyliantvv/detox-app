"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Instants from "@/components/instants";
import PostCard from "@/components/post-card";
import { Brand } from "@/components/top-bar";
import { BoltIcon, HeartIcon } from "@/components/icons";
import { CIRCLE_POSTS, flowPage } from "@/lib/mock-data";
import { readFlowPage, useDetox } from "@/lib/store";

const CHEST_EVERY_PAGES = 4;

export default function HomePage() {
  const state = useDetox();
  const [tab, setTab] = useState<"cercle" | "flow">("cercle");
  const [flowPages, setFlowPages] = useState(1);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadedPages = useRef(1);

  const circlePosts = [
    ...state.publishedPosts,
    ...CIRCLE_POSTS.filter((post) => state.following.includes(post.authorId)),
  ];
  const pagesRead = state.flowPagesRead.length;
  const pagesToChest = CHEST_EVERY_PAGES - (pagesRead % CHEST_EVERY_PAGES);
  const postsToChest = pagesToChest * 5;

  // Flow infini : chaque nouvelle page atteinte est « lue » et créditée.
  // TODO API : GET /api/feed/flow?page=N (le serveur crédite +10 une seule fois par page).
  useEffect(() => {
    if (tab !== "flow" || !sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        readFlowPage(loadedPages.current - 1);
        loadedPages.current += 1;
        setFlowPages(loadedPages.current);
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [tab]);

  return (
    <>
      <header className="flex min-h-11 items-center justify-between">
        <Brand />
        <Link href="/bilan" aria-label="Ton activité" title="Ton activité" className="relative p-1">
          <HeartIcon size={26} />
          <span className="absolute top-1 right-0.5 size-2.5 rounded-full border-2 border-ink bg-pink" />
        </Link>
      </header>

      <Instants />

      <section className="card flex items-center gap-3 px-4 py-3" aria-label="Progression du coffre">
        <BoltIcon size={20} className="shrink-0 text-lime" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Encore {postsToChest} posts avant ton coffre</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-lime transition-[width] duration-500"
              style={{ width: `${((CHEST_EVERY_PAGES - pagesToChest) / CHEST_EVERY_PAGES) * 100}%` }}
            />
          </div>
        </div>
        <span className="flex items-baseline gap-1.5">
          <span className="font-pixel text-sm text-lime tabular-nums">{state.points}</span>
          <span className="text-xs text-muted">pts</span>
        </span>
      </section>

      <div role="tablist" aria-label="Fil" className="grid grid-cols-2 border-b border-line">
        {(
          [
            ["cercle", "Mon cercle"],
            ["flow", "Flow"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 pb-2.5 font-display font-semibold transition-colors ${
              tab === id ? "border-fg text-fg" : "border-transparent text-muted"
            }`}
          >
            {label}
            {id === "flow" && <span className="ml-1.5 text-xs text-lime">+10/page</span>}
          </button>
        ))}
      </div>

      {tab === "cercle" ? (
        <div className="flex flex-col gap-8">
          {circlePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <p className="font-display text-lg font-bold">Tu as tout vu.</p>
            <p className="text-sm text-muted">
              Ton cercle est à jour. Le Flow, lui, ne s&apos;arrête jamais.
            </p>
            <button type="button" className="btn-lime" onClick={() => setTab("flow")}>
              Continuer sur le Flow
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from({ length: flowPages }, (_, page) =>
            flowPage(page).map((post) => <PostCard key={post.id} post={post} />),
          )}
          <div ref={sentinel} className="flex justify-center py-6 text-sm text-muted" aria-live="polite">
            Chargement de la page {flowPages + 1}…
          </div>
        </div>
      )}
    </>
  );
}
