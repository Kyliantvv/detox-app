import TopBar from "@/components/top-bar";
import ShopTabs from "./shop-tabs";

export default function ShopLayout({ children }: LayoutProps<"/epicerie">) {
  return (
    <>
      <TopBar title={<h1 className="font-display text-[26px] font-bold">L&apos;Épicerie</h1>} />
      <ShopTabs />
      {children}
      <p className="text-center text-xs text-muted">
        Simulation scolaire. Objets virtuels uniquement, aucun achat réel, rien n&apos;est livré.
      </p>
    </>
  );
}
