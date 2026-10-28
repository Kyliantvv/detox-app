"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Artwork from "@/components/artwork";
import Avatar from "@/components/avatar";
import { SearchIcon } from "@/components/icons";
import { useApiData } from "@/lib/api-client";
import type { ExploreTile, PublicUser } from "@/lib/types";

const FILTERS = ["Pour toi", "Tendances", "Amis", "Voyage"];
const DEBOUNCE_MS = 250;

// Recherche de comptes (GET /api/users?q=) et mosaïque d'exploration (GET /api/posts?explore=1).
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(FILTERS[0]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: found } = useApiData<{ items: PublicUser[] }>(q ? `/api/users?q=${encodeURIComponent(q)}` : null, {
    keepPreviousData: true,
  });
  const { data: explore } = useApiData<{ items: ExploreTile[] }>("/api/posts?explore=1");
  const accounts = found?.items ?? [];
  const tiles = (explore?.items ?? []).filter((tile) => tile.tags.includes(filter));

  return (
    <>
      <label className="input flex items-center gap-3">
        <SearchIcon size={20} className="text-muted" />
        <span className="sr-only">Rechercher un compte</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher"
          className="h-full flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>

      {query.trim() ? (
        <ul className="flex flex-col gap-1" aria-label="Comptes">
          {found && accounts.length === 0 && (
            <li className="py-10 text-center text-muted">
              Aucun compte pour « {query} ». Personne n&apos;a encore pensé à se détoxer sous ce nom.
            </li>
          )}
          {accounts.map((friend) => (
            <li key={friend.id}>
              <Link href={`/u/${friend.username}`} className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-panel">
                <Avatar name={friend.name} seed={friend.id} size={44} />
                <span className="leading-tight">
                  <span className="block font-semibold">{friend.username}</span>
                  <span className="text-sm text-muted">
                    {friend.name} · Niv. {friend.level}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Catégories">
            {FILTERS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={filter === name}
                onClick={() => setFilter(name)}
                className={`pill px-4 py-2 text-sm ${filter === name ? "border-transparent bg-sun text-ink" : ""}`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="-mx-4 grid grid-cols-3 gap-0.5">
            {tiles.map((tile, index) => (
              <div
                key={tile.id}
                className={index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}
              >
                <Artwork variant={tile.art} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
