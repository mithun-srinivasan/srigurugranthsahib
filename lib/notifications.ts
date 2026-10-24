/**
 * lib/notifications.ts
 * ---------------------------------------------------------------------------
 * Opt-in Daily Hukamnama reminders (feature: Hukamnama notifications).
 *
 * There is no push server by design (no accounts, no backend), so reminders
 * are delivered check-on-visit: when the Home page loads a fresh Hukamnama
 * for a new calendar day and the user opted in, a local notification is
 * shown via the service worker (falls back to the Notification constructor).
 * The honest limitation is stated in-UI: reminders appear when the app is
 * opened — installing the PWA and allowing notifications gives the best
 * results.
 *
 * Preferences live under `sgs-reader-notif-prefs` and join `BACKUP_KEYS`
 * (user data follows the hydrate → guard → debounce pattern in the toggle
 * component, mirroring `BookmarksProvider`).
 */

import type { HukamnamaInfo } from "./types";

/** localStorage key for the reminder preferences (backed up, see lib/backup.ts). */
export const NOTIF_PREFS_KEY = "sgs-reader-notif-prefs";

/** localStorage key recording the last day a reminder fired (`YYYY-MM-DD`). */
const LAST_NOTIFIED_KEY = "sgs-reader-last-notified";

/** Reminder preferences: enabled flag only. There is no scheduled time —
 *  reminders fire check-on-visit when the app is opened on a new day. */
export interface NotifPrefs {
  enabled: boolean;
}

const DEFAULT_PREFS: NotifPrefs = { enabled: false };

/** Reads validated prefs; any corruption falls back to disabled. */
export function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    return {
      enabled: parsed.enabled === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Persists prefs; never throws (private mode / quota). */
export function saveNotifPrefs(prefs: NotifPrefs): void {
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Non-fatal — the toggle reflects in-memory state for this session.
  }
}

/** Whether the Notification API exists in this browser. */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current permission state, or `"denied"` when the API is absent. */
export function notifPermission(): NotificationPermission {
  if (!notificationsSupported()) return "denied";
  return Notification.permission;
}

/**
 * Requests permission (must be called from a user gesture). Resolves to the
 * resulting permission state; never throws.
 */
export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Local calendar day key (`YYYY-MM-DD`) used to fire at most once per day. */
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Shows the reminder, preferring the service worker (works for installed
 * PWAs) and falling back to the page-context constructor. Never throws.
 */
async function showReminder(title: string, body: string): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if ("showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          tag: "sggs-hukamnama",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: { url: "/" },
        });
        return;
      }
    }
    if (notificationsSupported() && Notification.permission === "granted") {
      new Notification(title, { body, tag: "sggs-hukamnama" });
    }
  } catch {
    // A failed notification must never break the Home page.
  }
}

/**
 * Fires today's reminder exactly once per day when the user opted in and
 * permission is granted. Call after a fresh Hukamnama resolves.
 *
 * @returns `true` when a notification was shown.
 */
export async function maybeNotifyHukamnama(hukamnama: HukamnamaInfo): Promise<boolean> {
  try {
    const prefs = loadNotifPrefs();
    if (!prefs.enabled) return false;
    if (!notificationsSupported() || Notification.permission !== "granted") return false;
    const key = todayKey();
    if (localStorage.getItem(LAST_NOTIFIED_KEY) === key) return false;
    const firstLine = hukamnama.lines[0]?.gurmukhi ?? "";
    await showReminder(
      `Daily Hukamnama · Ang ${hukamnama.ang}`,
      firstLine.length > 120 ? `${firstLine.slice(0, 120)}…` : firstLine || hukamnama.dateLabel
    );
    try {
      localStorage.setItem(LAST_NOTIFIED_KEY, key);
    } catch {
      // Quota — the notification already fired; worst case it repeats tomorrow.
    }
    return true;
  } catch {
    return false;
  }
}
