"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Ordered the way a stack of cards moves through the business.
const ITEMS = [
  { href: "/", label: "Oversigt" },
  { href: "/purchases", label: "Indkøb" },
  { href: "/import", label: "Importér fra ManaBox" },
  { href: "/intake", label: "Scan enkeltkort" },
  { href: "/inventory", label: "Lager" },
  { href: "/pick", label: "Plukliste" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Hovedmenu">
      {ITEMS.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? "nav-item active" : "nav-item"} aria-current={active ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
