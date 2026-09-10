"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/components/providers";
import { ListSkeleton, Shell } from "@/components/shell";
import { TagManager } from "@/components/tag-manager";

function initials(name: string | null, email: string | null) {
  const source = (name || email || "Petals").trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function ProfilePage() {
  const { data, refresh, setToast } = useApp();
  const profile = data?.profile;
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setName(profile?.name ?? ""), [profile?.name]);

  if (!profile) {
    return <Shell><ListSkeleton /></Shell>;
  }

  const signedIn = profile.provider === "google";

  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      await refresh();
      setToast({ message: "Profile saved." });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Couldn’t save your profile." });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Couldn’t sign out." });
      setSigningOut(false);
    }
  }

  return (
    <Shell>
      <div className="profile-page">
        <div className="profile-heading">
          <div>
            <p className="profile-eyebrow">Account</p>
            <h1 className="page-title">Your profile</h1>
            <p className="page-sub mt-2">This is where Petals keeps your private workspace identity.</p>
          </div>
          {signedIn ? <span className="profile-provider"><ShieldCheck className="h-3.5 w-3.5" /> Google connected</span> : null}
        </div>

        <section className="profile-card">
          <div className="profile-avatar" aria-hidden>
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials(profile.name, profile.email)}
          </div>
          <div className="profile-fields">
            <label>
              <span>Display name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={80} />
            </label>
            <label>
              <span>Email</span>
              <input value={profile.email ?? "Only stored on this device"} disabled />
            </label>
            <div className="profile-actions">
              <button type="button" className="primary-btn" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </button>
              {signedIn ? (
                <button type="button" className="profile-signout" onClick={() => void signOut()} disabled={signingOut}>
                  <LogOut className="h-3.5 w-3.5" /> {signingOut ? "Signing out…" : "Sign out"}
                </button>
              ) : (
                <Link href="/login" className="profile-signin">Sign in with Google</Link>
              )}
            </div>
          </div>
        </section>

        <TagManager />
      </div>
    </Shell>
  );
}
