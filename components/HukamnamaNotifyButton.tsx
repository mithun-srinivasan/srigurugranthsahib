/**
 * components/HukamnamaNotifyButton.tsx
 * ---------------------------------------------------------------------------
 * Opt-in Daily Hukamnama reminder toggle (feature: Hukamnama notifications).
 *
 * A bell button for the Hukamnama card header. Enabling requests Notification
 * permission (inside the tap gesture, as browsers require) and stores the
 * choice under `sgs-reader-notif-prefs` — a backed-up user-data key following
 * the hydrate → `hydrated` guard → 500 ms debounce pattern. The actual
 * delivery is check-on-visit in `HukamnamaCard` (see lib/notifications.ts):
 * with no push server, reminders fire when the app is opened on a new day.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  loadNotifPrefs,
  notifPermission,
  notificationsSupported,
  requestNotifPermission,
  saveNotifPrefs,
} from "@/lib/notifications";

export default function HukamnamaNotifyButton() {
  /** Whether reminders are enabled (hydrated from localStorage on mount). */
  const [enabled, setEnabled] = useState(false);

  /** Guards against writing defaults before hydration (provider pattern). */
  const [hydrated, setHydrated] = useState(false);

  /** Current Notification permission (refreshed on every toggle tap). */
  const [permission, setPermission] = useState<NotificationPermission>("default");

  /** Debounce timer for persistence. */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Hydration: read once from localStorage on mount -----------------------

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate SSR-safe post-mount hydration from localStorage
      setEnabled(loadNotifPrefs().enabled);
      setPermission(notifPermission());
    } catch {
      // Storage unavailable — toggle stays in-memory for this session.
    } finally {
      setHydrated(true);
    }
  }, []);

  // -- Debounced persistence -------------------------------------------------

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNotifPrefs({ enabled }), 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [enabled, hydrated]);

  if (!notificationsSupported()) return null;

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    // Permission must be requested from the tap gesture or browsers ignore it.
    const next = await requestNotifPermission();
    setPermission(next);
    if (next === "granted") setEnabled(true);
  };

  const label =
    permission === "denied"
      ? "Notifications blocked — allow them in your browser settings to get reminders"
      : enabled
        ? "Reminder on — notifies when you open the app each day"
        : "Remind me each day I open the app";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label="Hukamnama reminders"
      title={label}
      className={`flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border transition active:scale-95 ${
        enabled
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--text-faint)] hover:text-[var(--text)]"
      }`}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
    </button>
  );
}
