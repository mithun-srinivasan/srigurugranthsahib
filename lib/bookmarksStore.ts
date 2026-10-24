/**
 * lib/bookmarksStore.ts
 * ---------------------------------------------------------------------------
 * External store for verse bookmarks, consumed via `useSyncExternalStore` with
 * a per-verse selector so toggling one verse re-renders only that VerseCard.
 *
 * Shares the `sgs-reader-bookmarks__v1` localStorage key with BookmarksProvider
 * so both consumers read the same data.  The provider remains the source of
 * truth for page-level features (import/export, list view, backup); this store
 * is a lightweight read/write facade for VerseCard.
 */

import type { Bookmark } from "./types";

/** localStorage key — must match BookmarksProvider's versioned key. */
const STORAGE_KEY = "sgs-reader-bookmarks__v1";

/** In-memory snapshot: verseId → bookmark. */
let bookmarks: Map<string, Bookmark> = new Map();

/** Subscribers notified on every mutation. */
const subscribers = new Set<() => void>();

/** Hydrate from localStorage (never throws). */
function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { bookmarks?: Record<string, Bookmark> };
    if (parsed?.bookmarks && typeof parsed.bookmarks === "object") {
      bookmarks = new Map(Object.entries(parsed.bookmarks));
    }
  } catch {
    // Corrupt storage — start empty.
    bookmarks = new Map();
  }
}

/** Persist to localStorage (never throws). */
function persist() {
  try {
    const obj: Record<string, Bookmark> = {};
    for (const [k, v] of bookmarks) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bookmarks: obj }));
  } catch {
    // Quota / private mode — non-fatal.
  }
}

/** Notify all subscribers (used by React's useSyncExternalStore). */
function notify() {
  for (const fn of subscribers) fn();
}

hydrate();

/** External-store API compatible with React's useSyncExternalStore. */
export const bookmarksStore = {
  /** Subscribe to store changes. */
  subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  /** Get the full snapshot (for page-level consumers). */
  getSnapshot(): Record<string, Bookmark> {
    const obj: Record<string, Bookmark> = {};
    for (const [k, v] of bookmarks) obj[k] = v;
    return obj;
  },
  /** Server snapshot (empty during SSR — bookmarks are client-only). */
  getServerSnapshot(): Record<string, Bookmark> {
    return {};
  },
  /** Get one verse's bookmark (per-verse selector target). */
  get(verseId: string): Bookmark | undefined {
    return bookmarks.get(verseId);
  },
  /** Toggle a bookmark on/off for a verse. */
  toggle(verseId: string, bookmark: Omit<Bookmark, "verseId">): void {
    const existing = bookmarks.get(verseId);
    if (existing) {
      bookmarks.delete(verseId);
    } else {
      bookmarks.set(verseId, { ...bookmark, verseId });
    }
    persist();
    notify();
  },
};
