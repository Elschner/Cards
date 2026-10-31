"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Ordered the way a stack of cards moves through the business.
const ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/purchases", label: "Purchases" },
  { href: "/import", label: "Import from ManaBox" },
  { href: "/intake", label: "Scan single cards" },
  { href: "/inventory", label: "Inventory" },
  { href: "/pick", label: "Pick list" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main menu">
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
