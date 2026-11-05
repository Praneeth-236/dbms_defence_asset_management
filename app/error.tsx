"use client";

export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="error"><div className="eyebrow">System notice</div><h1>Section unavailable</h1><p>We could not load this operational view. Retry without leaving the command center.</p><button className="button" onClick={reset}>Retry view</button></section>;
}
