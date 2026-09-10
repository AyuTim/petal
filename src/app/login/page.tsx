"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { BrandWordmark } from "@/components/petal-mark";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.22-.2-1.74H12v3.45h5.37c-.11.86-.73 2.16-2.1 3.03l-.02.12 3.05 2.36.21.02c1.95-1.8 2.84-4.45 2.84-7.24Z" />
      <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.46-2.37l-3.08-2.39c-.82.57-1.92.98-3.38.98-2.57 0-4.75-1.69-5.53-4l-.11.01-3.17 2.45-.04.1A9.75 9.75 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.47 13.97A5.87 5.87 0 0 1 6.16 12c0-.68.12-1.33.3-1.97v-.13L3.26 7.42l-.1.05A9.75 9.75 0 0 0 2.25 12c0 1.65.4 3.2.9 4.53l3.32-2.56Z" />
      <path fill="#EA4335" d="M12 6.03c1.84 0 3.08.8 3.79 1.47l2.77-2.7C16.83 3.16 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.84 5.22l3.3 2.56c.79-2.31 2.97-4 5.54-4Z" />
    </svg>
  );
}

export default function LoginPage() {
  const search = useSearchParams();
  const error = search.get("error");
  const message =
    error === "google-not-configured"
      ? "Google sign-in needs to be configured before it can be used."
      : error === "google-sign-in-failed"
        ? "That Google sign-in did not complete. Please try again."
        : null;

  return (
    <main className="login-page">
      <div className="login-ambient login-ambient-one" aria-hidden />
      <div className="login-ambient login-ambient-two" aria-hidden />
      <section className="login-card">
        <Link href="/" className="login-brand" aria-label="Go to Petals">
          <BrandWordmark />
        </Link>

        <div className="login-copy">
          <p className="login-eyebrow">Your private garden</p>
          <h1>Keep your lists with you.</h1>
          <p>Sign in to create a private profile and keep your wishes, plans, captures, and settings together.</p>
        </div>

        {message ? <p className="login-error" role="alert">{message}</p> : null}

        <a href="/api/auth/google" className="login-google-button">
          <GoogleGlyph />
          <span>Continue with Google</span>
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </a>

        <ul className="login-notes">
          <li><Check className="h-3.5 w-3.5" /> Your lists stay private to your profile.</li>
        </ul>
      </section>
    </main>
  );
}
