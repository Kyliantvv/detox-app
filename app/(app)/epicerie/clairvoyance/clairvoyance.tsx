"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import Avatar from "@/components/avatar";
import { EyeIcon, LockIcon, ShieldIcon } from "@/components/icons";
import { ApiClientError, useApi, useApiData } from "@/lib/api-client";
import { useApplyGains } from "@/lib/gains";
import type { IntelKey, PublicUser, SkillId, SkillView } from "@/lib/types";

type SkillsResponse = { items: SkillView[]; intel: Partial<Record<IntelKey, string>> };

const HIGHLIGHTS: { id: IntelKey; label: string; tone: string }[] = [
  { id: "solde", label: "Solde", tone: "font-pixel text-[13px] text-lime" },
  { id: "serie", label: "Série", tone: "font-display text-lg font-bold text-sun" },
  { id: "derniere-connexion", label: "Vu", tone: "font-display text-[15px] font-bold" },
];

// Compétences d'espionnage : achat unique par cible, cible jamais notifiée, métadonnées seulement.
// Cibles : GET /api/users. Catalogue et intel débloquée : GET /api/skills?targetId=. Achat : POST /api/skills/:id.
export default function Clairvoyance() {
  const api = useApi();
  const applyGains = useApplyGains();
  const { mutate } = useSWRConfig();
  const searchParams = useSearchParams();
  const { data: users } = useApiData<{ items: PublicUser[] }>("/api/users");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  const friends = users?.items ?? [];
  const available = friends.filter((friend) => !friend.shielded);
  const requested = available.find((friend) => friend.id === searchParams.get("cible"));
  const target = available.find((friend) => friend.id === selected) ?? requested ?? available[0];
  const skillsKey = target ? `/api/skills?targetId=${target.id}` : null;
  const { data: skills } = useApiData<SkillsResponse>(skillsKey);
  const owned = new Set(skills?.items.filter((skill) => skill.owned).map((skill) => skill.id));
  const intel = skills?.intel ?? {};

  const buy = async (skillId: SkillId) => {
    if (!target) return;
    try {
      await api.post(`/api/skills/${skillId}`, { targetId: target.id });
      await mutate(skillsKey);
      applyGains();
      setError("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Achat impossible.");
    }
  };

  if (!target) return <div className="card h-64 animate-pulse" aria-label="Chargement des cibles" />;

  return (
    <>
      <div>
        <h2 className="font-display text-[26px] font-bold">Clairvoyance</h2>
        <p className="text-muted">Choisis un ami. Regarde ce qu&apos;il cache.</p>
      </div>

      <ul className="flex flex-col gap-2" aria-label="Cibles">
        {friends.map((friend) => {
          const isTarget = friend.id === target.id;
          return (
            <li key={friend.id}>
              <button
                type="button"
                disabled={friend.shielded}
                onClick={() => {
                  setSelected(friend.id);
                  setError("");
                }}
                aria-pressed={isTarget}
                className={`card flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isTarget ? "border-pink" : ""
                }`}
              >
                <Avatar name={friend.name} seed={friend.id} size={42} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-semibold">{friend.name}</span>
                  <span className="flex items-center gap-1 text-sm text-muted">
                    {friend.shielded && <ShieldIcon size={14} className="text-sun" />}
                    {friend.status}
                  </span>
                </span>
                <span className={`text-sm ${isTarget ? "font-semibold text-pink" : "text-muted"}`}>
                  Niv. {friend.level}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="card flex flex-col gap-4 p-4" aria-label={`Ce que tu vois chez ${target.name}`}>
        <h3 className="font-display text-lg font-bold">Ce que tu vois chez {target.name}</h3>
        <div className="grid grid-cols-3 gap-2">
          {HIGHLIGHTS.map(({ id, label, tone }) => (
            <div key={id} className="rounded-xl border border-line bg-panel-2 px-3 py-2.5">
              <p className="text-xs text-muted">{label}</p>
              {owned.has(id) ? (
                <p className={`mt-1 truncate ${tone}`}>{intel[id]}</p>
              ) : (
                <LockIcon size={18} className="mt-1.5 text-muted" />
              )}
            </div>
          ))}
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {!skills && <li className="h-40 animate-pulse" aria-label="Chargement des compétences" />}
          {skills?.items.map((skill) => {
            const unlocked = skill.owned;
            return (
              <li key={skill.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{skill.name}</p>
                  <p className={`text-sm ${unlocked ? "text-fg" : "text-muted"}`}>
                    {unlocked
                      ? skill.id === "dossier-complet"
                        ? "Tout est débloqué ci-dessus."
                        : intel[skill.id]
                      : skill.shows}
                  </p>
                </div>
                {unlocked ? (
                  <span className="pill border-lime text-lime">
                    <EyeIcon size={14} /> Vu
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => buy(skill.id)}
                    className={`btn min-h-10 shrink-0 px-3 text-sm ${
                      skill.id === "dossier-complet" ? "bg-pink text-ink" : "bg-sun text-ink"
                    }`}
                    aria-label={`Acheter ${skill.name} sur ${target.name} pour ${skill.price} points`}
                  >
                    {skill.price} pts
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {error && (
          <p role="alert" className="rounded-xl border border-pink px-4 py-3 text-sm text-pink">
            {error}
          </p>
        )}
      </section>

      <p className="text-center text-sm text-muted">
        {target.name} ne sera jamais prévenu. Personne ne l&apos;est. Seulement des métadonnées, jamais le contenu des
        messages.
      </p>
    </>
  );
}
