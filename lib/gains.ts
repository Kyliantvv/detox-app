"use client";

// Bulle « +10 pts » : les gains renvoyés par l'API sont affichés l'un après l'autre.
import { useCallback, useSyncExternalStore } from "react";
import { useSWRConfig } from "swr";
import type { PointEvent, PointsResponse } from "./types";

const STEP_MS = 900;
let current: PointEvent | null = null;
const listeners = new Set<() => void>();

function show(gain: PointEvent) {
  current = gain;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useLastGain = () => useSyncExternalStore(subscribe, () => current, () => null);

// À appeler après chaque action : affiche les gains et rafraîchit solde, série et stats.
export function useApplyGains() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (response?: Partial<PointsResponse>) => {
      response?.gains?.forEach((gain, index) => window.setTimeout(() => show(gain), index * STEP_MS));
      void mutate("/api/me");
    },
    [mutate],
  );
}
