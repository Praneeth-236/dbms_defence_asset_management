import "./globals.css";
import "./dashboard.css";
import { currentSession } from "../lib/auth";
import NavLinks from "./nav-links";
import Topbar from "./topbar";

export const metadata = {
  title: "Defence Asset Readiness",
  description: "Dependency-aware maintenance and readiness analysis"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) {
    return (
      <html lang="en">
        <body className="auth-page">{children}</body>
      </html>
    );
  }
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand-block">
              <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 46"><path d="M20 2 36 7v15c0 10-6 17-16 22C10 39 4 32 4 22V7L20 2Z" /><path d="m20 10-3 10-7 8 8-3 2 10 2-10 8 3-7-8-3-10Z" /></svg></div>
              <div className="brand">
                <strong>D-ARMS</strong>
                <small>Defence Asset Readiness &amp;<br /> Maintenance System</small>
              </div>
            </div>
            <NavLinks />
          </aside>
          <main className="main">
            <Topbar userName={session.userName} role={session.role} />
            <div className="page-content">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
