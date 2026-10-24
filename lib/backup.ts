/**
 * lib/backup.ts
 * ---------------------------------------------------------------------------
 * Full local-data backup (item 6): every user-data slice lives in its own
 * localStorage key with no account or sync, so a cleared browser profile
 * wipes bookmarks, notes, highlights, progress, preferences, and reminder
 * choices at once.
 *
 * This module snapshots all six keys into one timestamped JSON file and
 * restores them with per-slice shape validation.  The bookmarks page hosts
 * the Export / Import UI; a successful import reloads the page so every
 * provider rehydrates from the restored keys.  Device-to-device transfer
 * without a server uses the same envelope over WebRTC (see lib/sync.ts).
 *
 * Backup file shape:
 *   { app, version, exportedAt, data: { bookmarks?, notes?, highlights?,
 *     progress?, prefs?, notifs? } }
 *
 * Storage keys are versioned (e.g., sgs-reader-bookmarks__v1) via lib/persist.ts.
 * This module reads from versioned keys but falls back to unversioned keys for
 * backward compatibility with existing users.
 */

const BACKUP_APP = "sggs-reader";
const BACKUP_VERSION = 1;
const STORAGE_VERSION = 1; // Must match lib/persist.ts

/** Builds the versioned storage key. */
function versionedKey(baseKey: string): string {
  return `${baseKey}__v${STORAGE_VERSION}`;
}

/** Every localStorage key included in a full backup (base keys, unversioned). */
export const BACKUP_KEYS = [
  "sgs-reader-bookmarks",
  "sgs-reader-notes",
  "sgs-reader-highlights",
  "sgs-reader-progress",
  "sgs-reader-prefs",
  "sgs-reader-notif-prefs",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

export interface FullBackup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: Partial<Record<BackupKey, unknown>>;
}

/** Reads every known key; missing keys are simply omitted from the snapshot.
 *  Tries versioned key first, falls back to unversioned for backward compat. */
export function collectBackup(): FullBackup {
  const data: Partial<Record<BackupKey, unknown>> = {};
  for (const key of BACKUP_KEYS) {
    try {
      // Try versioned key first (new format)
      const vKey = versionedKey(key);
      let raw = localStorage.getItem(vKey);
      // Fall back to unversioned key for existing users
      if (raw === null) raw = localStorage.getItem(key);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch {
      // Corrupt slice — skip it rather than failing the whole backup.
    }
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Downloads the full snapshot as `sggs-reader-backup-<date>.json`. */
export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(collectBackup(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sggs-reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  try {
    localStorage.setItem("sggs-reader-last-backup", new Date().toISOString());
  } catch {
    // Quota / private mode — the download itself already succeeded.
  }
}

/** Returns the ISO timestamp of the last full backup, if any. */
export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem("sggs-reader-last-backup");
  } catch {
    return null;
  }
}

/**
 * Restores a snapshot file: validates the envelope, writes back only slices
 * that parse to an object/array, and returns how many slices were restored.
 * Returns 0 when the file is not a valid backup.  Callers should reload the
 * page on success so all providers rehydrate.
 * Writes to versioned keys (sgs-reader-XXX__v1) for the new persist.ts format.
 */
export function restoreBackup(json: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return 0;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as FullBackup).app !== BACKUP_APP ||
    typeof (parsed as FullBackup).data !== "object" ||
    (parsed as FullBackup).data === null
  ) {
    return 0;
  }
  let restored = 0;
  const data = (parsed as FullBackup).data;
  for (const key of BACKUP_KEYS) {
    const slice = data[key];
    if (slice === undefined) continue;
    if (typeof slice !== "object" || slice === null) continue;
    try {
      // Write to versioned key for new persist.ts format
      localStorage.setItem(versionedKey(key), JSON.stringify(slice));
      restored += 1;
    } catch {
      // Quota — keep restoring the remaining slices.
    }
  }
  return restored;
}
