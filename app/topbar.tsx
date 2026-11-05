"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./logout-button";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/assets": "Assets",
  "/work-orders": "Maintenance",
  "/failures": "Failures",
  "/dependencies": "Components",
  "/inventory": "Inventory",
  "/reports": "Reports"
};

export default function Topbar({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? Object.entries(pageTitles).find(([path]) => path !== "/" && pathname.startsWith(path))?.[1] ?? "D-ARMS";

  return (
    <header className="app-topbar">
      <div className="topbar-title"><span className="topbar-eyebrow">D-ARMS / Operations</span><h1>{title}</h1></div>
      <div className="topbar-actions">
        <form action="/assets" className="global-search" role="search">
          <label className="sr-only" htmlFor="global-asset-search">Search assets by name, identification number, or model</label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <input id="global-asset-search" name="q" placeholder="Search assets by name, ID, or model" />
        </form>
        <Link className="topbar-alert-link" href="/failures" aria-label="View recorded failure events">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
          <span>Failure log</span>
        </Link>
        <details className="user-menu">
          <summary aria-label={`User menu for ${userName}`}><span className="user-avatar">{userName.slice(0, 1).toUpperCase()}</span><span className="user-menu-name"><strong>{userName}</strong><small>{role}</small></span><span className="user-menu-chevron" aria-hidden="true">⌄</span></summary>
          <div className="user-menu-popover"><span className="muted">Signed in as {role}</span><LogoutButton /></div>
        </details>
      </div>
    </header>
  );
}
