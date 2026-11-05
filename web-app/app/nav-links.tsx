"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "⌂" },
  { href: "/assets", label: "Assets", icon: "✈" },
  { href: "/work-orders", label: "Maintenance", icon: "⚒" },
  { href: "/failures", label: "Failures", icon: "△" },
  { href: "/dependencies", label: "Components", icon: "◇" },
  { href: "/inventory", label: "Inventory", icon: "▣" },
  { href: "/reports", label: "Reports", icon: "▥" }
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary navigation">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link href={link.href} key={link.href} aria-current={active ? "page" : undefined}>
            <span className="nav-icon" aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
