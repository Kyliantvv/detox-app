"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useDetox } from "@/lib/store";
import BottomNav from "./bottom-nav";
import GainToast from "./gain-toast";

// Coque mobile des écrans connectés : redirige vers /connexion sans session.
// TODO API : vérifier le token via GET /api/me au lieu de l'état local.
export default function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, user } = useDetox();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) router.replace("/connexion");
  }, [hydrated, user, router]);

  // La page est toujours rendue (pré-rendu et navigation instantanée de Next),
  // mais reste masquée tant que la session locale n'est pas chargée.
  const ready = hydrated && !!user;

  return (
    <div
      className={`relative mx-auto min-h-dvh max-w-[480px] border-line sm:border-x ${ready ? "" : "invisible"}`}
      aria-busy={!ready}
    >
      <main className="flex flex-col gap-4 px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <GainToast />
      <BottomNav />
    </div>
  );
}
