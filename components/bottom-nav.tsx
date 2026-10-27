"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDetox } from "@/lib/store";
import Avatar from "./avatar";
import { BagIcon, HomeIcon, ReelsIcon, SearchIcon, SendIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Accueil", Icon: HomeIcon },
  { href: "/reels", label: "Reels", Icon: ReelsIcon },
  { href: "/messages", label: "Messages", Icon: SendIcon },
  { href: "/recherche", label: "Recherche", Icon: SearchIcon },
  { href: "/epicerie", label: "L'Épicerie", Icon: BagIcon },
];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useDetox();
  const profileActive = isActive(pathname, "/profil");

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[calc(64px+env(safe-area-inset-bottom))] max-w-[480px] grid-cols-6 border-t border-line bg-ink pb-[env(safe-area-inset-bottom)]"
    >
      {LINKS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={active ? "page" : undefined}
            className={`grid place-items-center transition-colors ${active ? "text-pink" : "text-muted hover:text-fg"}`}
          >
            <Icon />
          </Link>
        );
      })}
      <Link
        href="/profil"
        aria-label="Profil"
        title="Profil"
        aria-current={profileActive ? "page" : undefined}
        className="grid place-items-center"
      >
        <span className={`rounded-full ${profileActive ? "ring-2 ring-pink ring-offset-2 ring-offset-ink" : ""}`}>
          <Avatar name={user?.username ?? "?"} size={28} />
        </span>
      </Link>
    </nav>
  );
}
