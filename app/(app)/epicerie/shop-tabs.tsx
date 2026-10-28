"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/epicerie", label: "Objets" },
  { href: "/epicerie/clairvoyance", label: "Clairvoyance" },
  { href: "/epicerie/jeux", label: "Jeux" },
];

export default function ShopTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Rayons de L'Épicerie" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-panel-2 p-1">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl py-2.5 text-center text-[15px] font-semibold transition-colors ${
              active ? "bg-sun text-ink" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
