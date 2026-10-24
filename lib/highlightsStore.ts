/**
 * lib/highlightsStore.ts
 * ---------------------------------------------------------------------------
 * External store for verse highlights, consumed via `useSyncExternalStore`
 * with a per-verse selector so toggling one verse re-renders only that
 * VerseCard.
 *
 * Shares the `sgs-reader-highlights__v1` localStorage key with
 * HighlightsProvider.
 */

import type { HighlightColor } from "./types";

const STORAGE_KEY = "sgs-reader-highlights__v1";

let highlights: Map<string, HighlightColor> = new Map();
const subscribers = new Set<() => void>();

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, HighlightColor>;
    if (parsed && typeof parsed === "object") {
      highlights = new Map(Object.entries(parsed));
    }
  } catch {
    highlights = new Map();
  }
}

function persist() {
  try {
    const obj: Record<string, HighlightColor> = {};
    for (const [k, v] of highlights) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Quota / private mode — non-fatal.
  }
}

function notify() {
  for (const fn of subscribers) fn();
}

hydrate();

export const highlightsStore = {
  subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  getSnapshot(): Record<string, HighlightColor> {
    const obj: Record<string, HighlightColor> = {};
    for (const [k, v] of highlights) obj[k] = v;
    return obj;
  },
  getServerSnapshot(): Record<string, HighlightColor> {
    return {};
  },
  get(verseId: string): HighlightColor | undefined {
    return highlights.get(verseId);
  },
  toggle(verseId: string, color?: HighlightColor): void {
    const existing = highlights.get(verseId);
    if (existing && (!color || existing === color)) {
      highlights.delete(verseId);
    } else if (color) {
      highlights.set(verseId, color);
    }
    persist();
    notify();
  },
};
