"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Palette, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/components/providers";
import { Modal } from "@/components/shell";

export function WelcomeDialog() {
  const { data, refresh, setToast } = useApp();
  const [open, setOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (data?.profile && !data.profile.onboardingCompleted) setOpen(true);
  }, [data?.profile?.id, data?.profile?.onboardingCompleted]);

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ onboardingCompleted: true }) });
      setOpen(false);
      await refresh();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Couldn’t save your welcome progress." });
    } finally {
      setFinishing(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => void finish()}
      className="welcome-modal"
      title={
        <div className="welcome-title">
          <img src="/petals-flower-logo.png" alt="" />
          <span>Welcome to petals</span>
        </div>
      }
      footer={
        <button type="button" className="welcome-start" onClick={() => void finish()} disabled={finishing}>
          {finishing ? "Saving…" : "Let’s begin"} <Check className="h-4 w-4" />
        </button>
      }
    >
      <div className="welcome-copy">
        <p className="welcome-eyebrow">YOUR PRIVATE GARDEN</p>
        <h2>A calm place for what matters to you.</h2>
        <p>Start with the little guide already waiting for you, then shape Petals around your own plans, wishes, and memories.</p>
      </div>
      <div className="welcome-steps">
        <div className="welcome-step">
          <span className="welcome-step-icon"><Plus /></span>
          <div><strong>Begin with your starter list</strong><p>Rename it, edit its steps, or make a new list whenever you’re ready.</p></div>
        </div>
        <div className="welcome-step">
          <span className="welcome-step-icon"><CalendarDays /></span>
          <div><strong>Put plans on the calendar</strong><p>Add a date to any item and it will appear in both Calendar and Timeline.</p></div>
        </div>
        <div className="welcome-step">
          <span className="welcome-step-icon"><Palette /></span>
          <div><strong>Keep it personal</strong><p>Use Mood for visual ideas and Memories for moments you want to hold onto.</p></div>
        </div>
      </div>
    </Modal>
  );
}
