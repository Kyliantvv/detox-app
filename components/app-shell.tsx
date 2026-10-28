"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import BottomNav from "./bottom-nav";
import GainToast from "./gain-toast";

// Coque mobile des écrans connectés. proxy.ts bloque déjà l'accès sans session ;
// ici on couvre la session qui expire pendant que l'app est ouverte.
export default function AppShell({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/connexion");
  }, [status, router]);

  // La page est toujours rendue (pré-rendu et navigation instantanée de Next),
  // mais reste masquée tant que la session (et donc le token de l'API) n'est pas chargée.
  const ready = status === "authenticated";

  return (
    <div
      className={`relative mx-auto min-h-dvh max-w-[480px] border-line sm:border-x ${ready ? "" : "invisible"}`}
      aria-busy={!ready}
    >
      <main className="flex flex-col gap-4 px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <GainToast />
      {/* usePathname() est une donnée d'exécution sur les routes dynamiques (/messages/[id], /u/[username]). */}
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 z-30 mx-auto h-16 max-w-[480px] border-t border-line bg-ink" />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
