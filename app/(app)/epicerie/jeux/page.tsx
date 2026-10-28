"use client";

import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ApiClientError, useApi, useApiData, useMe } from "@/lib/api-client";
import { TICKET_PRICE } from "@/lib/game";
import { useApplyGains } from "@/lib/gains";
import type { PointsResponse, TicketView } from "@/lib/types";

type TicketResponse = { ticket: TicketView };

function valueTone(value: number) {
  if (value === 0) return "text-muted";
  if (value >= 500) return "text-pink";
  if (value >= 200) return "text-sun";
  return "text-lime";
}

// Les cases non grattées arrivent à null : le serveur ne les dévoile qu'au grattage.
function verdict(ticket: TicketView) {
  const remaining = ticket.revealed.filter((revealed) => !revealed).length;
  const shown = ticket.cells.filter((value) => value !== null);
  if (remaining === 0) {
    const win = ticket.winnings ?? 0;
    return win > 0
      ? { lead: "Gagné.", text: `Trois +${win} identiques : +${win} pts. Tu rejoues ?` }
      : { lead: "Perdu.", text: "Presque. Vraiment presque. Le prochain sera le bon." };
  }
  const pair = shown.find((value, index) => value > 0 && shown.indexOf(value) !== index);
  if (pair) {
    return {
      lead: remaining === 1 ? "Plus qu'une case." : `Plus que ${remaining} cases.`,
      text: `Trois +${pair} identiques, et ce sont ${pair} pts.`,
    };
  }
  return { lead: "Gratte.", text: "Trois montants identiques et ils sont à toi." };
}

// Ticket à gratter : tirage (POST /api/dice) et grattage (POST /api/ticket/scratch) faits par le serveur.
export default function GamesPage() {
  const api = useApi();
  const applyGains = useApplyGains();
  const { mutate } = useSWRConfig();
  const { data: me } = useMe();
  // 404 = aucun ticket en cours : pas la peine de réessayer.
  const { data } = useApiData<TicketResponse>("/api/ticket", { shouldRetryOnError: false });
  const ticket = data?.ticket ?? null;
  const points = me?.stats.points ?? 0;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const play = async (request: () => Promise<TicketResponse & Partial<PointsResponse>>) => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await request();
      await mutate("/api/ticket", { ticket: response.ticket }, { revalidate: false });
      applyGains(response);
      setError("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Le ticket ne répond pas.");
    } finally {
      setBusy(false);
    }
  };

  const newTicket = () => play(() => api.post("/api/dice"));
  const scratchCell = (index: number) => play(() => api.post("/api/ticket/scratch", { index }));

  const remaining = ticket ? ticket.revealed.filter((revealed) => !revealed).length : 0;
  const message = ticket ? verdict(ticket) : null;

  return (
    <>
      <div>
        <h2 className="font-display text-[26px] font-bold">Ticket à gratter</h2>
        <p className="text-muted">Presque. Gratte encore.</p>
      </div>

      {ticket ? (
        <section className="flex flex-col gap-4 rounded-3xl border-2 border-sun bg-panel p-4" aria-label="Ticket Détox">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-bold text-sun">Ticket Détox</p>
            <p className="text-sm text-muted">Jusqu&apos;à 1 000 pts</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {ticket.cells.map((value, index) =>
              value !== null ? (
                <div
                  key={index}
                  className={`grid aspect-square animate-pop place-items-center rounded-2xl border border-line bg-ink font-display font-bold ${
                    value >= 1000 ? "text-2xl" : "text-3xl"
                  } ${valueTone(value)}`}
                >
                  {value === 0 ? "0" : `+${value}`}
                </div>
              ) : (
                <button
                  key={index}
                  type="button"
                  onClick={() => void scratchCell(index)}
                  className="scratch grid aspect-square place-items-center rounded-2xl border border-line font-semibold transition-transform active:scale-95"
                  aria-label={`Gratter la case ${index + 1}`}
                >
                  Gratte
                </button>
              ),
            )}
          </div>
          {message && (
            <p className="text-center" aria-live="polite">
              <span className="font-semibold text-sun">{message.lead}</span> {message.text}
            </p>
          )}
        </section>
      ) : (
        <section className="card flex flex-col items-center gap-3 p-6 text-center">
          <p className="font-display text-xl font-bold">Pas de ticket en cours</p>
          <p className="text-sm text-muted">Six cases, trois montants identiques, jusqu&apos;à 1 000 pts.</p>
        </section>
      )}

      {ticket && remaining > 0 && (
        <button
          type="button"
          className="btn-sun"
          onClick={() => void scratchCell(ticket.revealed.findIndex((revealed) => !revealed))}
        >
          {remaining === 1 ? "Gratter la dernière case" : "Gratter une case"}
        </button>
      )}
      <button
        type="button"
        className={ticket && remaining > 0 ? "btn-ghost" : "btn-sun"}
        onClick={() => void newTicket()}
        disabled={!!ticket && remaining > 0}
      >
        Nouveau ticket · {TICKET_PRICE} pts
      </button>
      {error && (
        <p role="alert" className="rounded-xl border border-pink px-4 py-3 text-sm text-pink">
          {error}
        </p>
      )}
      <Link href="/epicerie" className="text-center font-semibold text-lime">
        Loot box · 600 pts
      </Link>
      <p className="text-center text-xs text-muted">
        Jeu fictif, points virtuels uniquement ({points} pts en poche). Joue avec modération.
      </p>
    </>
  );
}
