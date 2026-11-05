import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">DA</div>
          <div className="brand">DEFENCE ASSET<small>READINESS / MAINTENANCE</small></div>
        </div>
        <div className="auth-copy">
          <div className="eyebrow">Operational readiness platform</div>
          <h1>Make every asset count.</h1>
          <p>Connect fleet condition, maintenance pressure, supply risk, and component dependencies in one controlled command view.</p>
        </div>
        <div className="login-radar" aria-hidden="true">
          <svg viewBox="0 0 360 120" role="presentation">
            <path d="M18 98h324M40 98a140 140 0 0 1 280 0M75 98a105 105 0 0 1 210 0M110 98a70 70 0 0 1 140 0" />
            <path className="radar-sweep" d="M180 98 275 40" />
            <circle className="radar-dot" cx="275" cy="40" r="4" />
            <path className="aircraft" d="m60 72 45-6 28-17 7 3-17 19 39 7-2 6-43-4-15 13-6-2 6-13-42-2z" />
          </svg>
        </div>
        <div className="auth-note"><span className="status-dot" aria-hidden="true" /> Secure, database-backed access</div>
      </section>
      <section className="auth-card" aria-labelledby="login-title">
        <div className="eyebrow">Secure access</div>
        <h2 id="login-title">Sign in to operations</h2>
        <p className="muted">Use an approved Admin or Analyst account.</p>
        <LoginForm />
      </section>
    </main>
  );
}
