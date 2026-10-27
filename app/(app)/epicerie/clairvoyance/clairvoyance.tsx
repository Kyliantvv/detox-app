"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/avatar";
import { EyeIcon, LockIcon, ShieldIcon } from "@/components/icons";
import { FRIENDS, friendById, INTEL, SKILLS } from "@/lib/mock-data";
import { buySkill, useDetox } from "@/lib/store";
import type { SkillId } from "@/lib/types";

const HIGHLIGHTS: { id: Exclude<SkillId, "dossier-complet">; label: string; tone: string }[] = [
  { id: "solde", label: "Solde", tone: "font-pixel text-[13px] text-lime" },
  { id: "serie", label: "Série", tone: "font-display text-lg font-bold text-sun" },
  { id: "derniere-connexion", label: "Vu", tone: "font-display text-[15px] font-bold" },
];

// Compétences d'espionnage : achat unique par cible, cible jamais notifiée, métadonnées seulement.
// TODO API : GET /api/skills?targetId=, POST /api/skills/:skillId { targetId }.
export default function Clairvoyance() {
  const state = useDetox();
  const searchParams = useSearchParams();
  const [targetId, setTargetId] = useState(() => {
    const requested = searchParams.get("cible");
    return requested && friendById(requested) && !friendById(requested)?.shielded ? requested : "karim";
  });
  const [error, setError] = useState("");

  const target = friendById(targetId)!;
  const owned = state.skills[targetId] ?? [];
  const intel = INTEL[targetId];

  const buy = (skillId: SkillId) => {
    setError(buySkill(targetId, skillId) ?? "");
  };

  return (
    <>
      <div>
        <h2 className="font-display text-[26px] font-bold">Clairvoyance</h2>
        <p className="text-muted">Choisis un ami. Regarde ce qu&apos;il cache.</p>
      </div>

      <ul className="flex flex-col gap-2" aria-label="Cibles">
        {FRIENDS.map((friend) => {
          const selected = friend.id === targetId;
          return (
            <li key={friend.id}>
              <button
                type="button"
                disabled={friend.shielded}
                onClick={() => {
                  setTargetId(friend.id);
                  setError("");
                }}
                aria-pressed={selected}
                className={`card flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected ? "border-pink" : ""
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
                <span className={`text-sm ${selected ? "font-semibold text-pink" : "text-muted"}`}>
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
              {owned.includes(id) ? (
                <p className={`mt-1 truncate ${tone}`}>{intel[id]}</p>
              ) : (
                <LockIcon size={18} className="mt-1.5 text-muted" />
              )}
            </div>
          ))}
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {SKILLS.map((skill) => {
            const unlocked = owned.includes(skill.id);
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
