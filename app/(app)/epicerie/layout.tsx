import { Suspense } from "react";
import TopBar from "@/components/top-bar";
import ShopTabs from "./shop-tabs";

export default function ShopLayout({ children }: LayoutProps<"/epicerie">) {
  return (
    <>
      <TopBar title={<h1 className="font-display text-[26px] font-bold">L&apos;Épicerie</h1>} />
      {/* ShopTabs lit usePathname : sous Suspense, sinon la page à paramètre commandes/[id] casse le build (cacheComponents). */}
      <Suspense fallback={<div className="h-12 rounded-2xl border border-line bg-panel-2" />}>
        <ShopTabs />
      </Suspense>
      {children}
      <p className="text-center text-xs text-muted">
        Simulation scolaire. Objets virtuels uniquement, aucun achat réel, rien n&apos;est livré.
      </p>
    </>
  );
}
