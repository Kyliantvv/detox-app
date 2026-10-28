"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Instants from "@/components/instants";
import PostCard from "@/components/post-card";
import { Brand } from "@/components/top-bar";
import { BoltIcon, HeartIcon } from "@/components/icons";
import { useApi, useApiData, useMe } from "@/lib/api-client";
import { CHEST_EVERY_PAGES } from "@/lib/game";
import { useApplyGains } from "@/lib/gains";
import type { PointsResponse, PostView } from "@/lib/types";

type FlowPage = PointsResponse & { items: PostView[]; page: number; nextPage: number | null };

export default function HomePage() {
  const api = useApi();
  const applyGains = useApplyGains();
  const { data: me } = useMe();
  const { data: circle } = useApiData<{ items: PostView[] }>("/api/feed/circle");
  const [tab, setTab] = useState<"cercle" | "flow">("cercle");
  const [flowPosts, setFlowPosts] = useState<PostView[]>([]);
  const [flowError, setFlowError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const nextPage = useRef<number | null>(0);
  const loading = useRef(false);

  const pagesRead = me?.stats.flowPagesRead ?? 0;
  const points = me?.stats.points ?? 0;
  const pagesToChest = CHEST_EVERY_PAGES - (pagesRead % CHEST_EVERY_PAGES);
  const postsToChest = pagesToChest * 5;

  // Flow infini : chaque page atteinte est demandée au serveur, qui la crédite une seule fois.
  // L'observateur est recréé après chaque page : il se redéclenche si le repère est encore visible.
  useEffect(() => {
    if (tab !== "flow" || !sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const page = nextPage.current;
        if (!entry.isIntersecting || loading.current || page === null) return;
        loading.current = true;
        api
          .get<FlowPage>(`/api/feed/flow?page=${page}`)
          .then((response) => {
            nextPage.current = response.nextPage;
            setFlowPosts((posts) => [...posts, ...response.items]);
            setFlowError("");
            applyGains(response);
          })
          .catch(() => setFlowError("Le Flow s'est arrêté un instant. Fais défiler pour réessayer."))
          .finally(() => {
            loading.current = false;
          });
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [tab, flowPosts.length, flowError, api, applyGains]);

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
          <span className="font-pixel text-sm text-lime tabular-nums">{points}</span>
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
          {!circle && <div className="card h-96 animate-pulse" aria-label="Chargement du fil" />}
          {circle?.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <p className="font-display text-lg font-bold">Tu as tout vu.</p>
            <p className="text-sm text-muted">
              Ton cercle est à jour. Découvre la suite dans le Flow.
            </p>
            <button type="button" className="btn-lime" onClick={() => setTab("flow")}>
              Continuer sur le Flow
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {flowPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <div ref={sentinel} className="flex justify-center py-6 text-sm text-muted" aria-live="polite">
            {flowError || `Chargement de la page ${flowPosts.length / 5 + 1}…`}
          </div>
        </div>
      )}
    </>
  );
}
