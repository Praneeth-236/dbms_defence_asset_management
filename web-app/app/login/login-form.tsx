"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Signing in...");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(result?.error ?? "Unable to sign in. Try again.");
        return;
      }
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") && !requestedPath.includes("\\")
        ? requestedPath
        : "/";
      router.push(destination);
      router.refresh();
    } catch {
      setMessage("The application server cannot be reached. Start the app and try again.");
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label htmlFor="userName">Username<input id="userName" name="userName" autoComplete="username" required maxLength={50} /></label>
      <label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} /></label>
      <button className="button" type="submit">Sign in</button>
      {message && <p className="muted" role="status">{message}</p>}
    </form>
  );
}
