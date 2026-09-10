"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/components/providers";
import { ListSkeleton, Shell } from "@/components/shell";
import { TagManager } from "@/components/tag-manager";
import { ACCENT, PASTELS, brightenPastel } from "@/lib/palette";

function initials(name: string | null, email: string | null) {
  const source = (name || email || "Petals").trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function WorkspaceAccent() {
  const { data, patchSettings } = useApp();
  const accent = brightenPastel(data?.settings.accentColor || ACCENT.hex);
  const isCustom = !PASTELS.some((color) => color.hex.toLowerCase() === accent.toLowerCase());

  return (
    <section className="profile-accent-card">
      <div className="profile-accent-heading">
        <div>
          <p className="profile-eyebrow">Personalize petals</p>
          <h2>Workspace accent</h2>
        </div>
        <p>Colors your selected list and app details.</p>
      </div>
      <div className="profile-accent-swatches">
        {PASTELS.map((color) => {
          const selected = accent.toLowerCase() === color.hex.toLowerCase();
          return (
            <button
              key={color.id}
              type="button"
              title={color.name}
              aria-label={`${color.name} workspace accent`}
              aria-pressed={selected}
              onClick={() => void patchSettings({ accentColor: color.hex })}
              className="profile-accent-choice"
            >
              <span className={selected ? "is-selected" : ""} style={{ backgroundColor: color.hex }} />
              <small>{color.name}</small>
            </button>
          );
        })}
        <label title="Custom color" className="profile-accent-choice">
          <span className={`profile-accent-custom ${isCustom ? "is-selected" : ""}`} style={isCustom ? { backgroundColor: accent } : undefined}>
            {!isCustom ? "+" : null}
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : ACCENT.hex}
              onChange={(event) => void patchSettings({ accentColor: event.target.value })}
              aria-label="Custom workspace accent"
            />
          </span>
          <small>Custom</small>
        </label>
      </div>
    </section>
  );
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

        <WorkspaceAccent />
        <TagManager />
      </div>
    </Shell>
  );
}
