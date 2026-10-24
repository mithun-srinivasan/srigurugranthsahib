/**
 * lib/notesStore.ts
 * ---------------------------------------------------------------------------
 * External store for verse notes, consumed via `useSyncExternalStore`
 * with a per-verse selector so editing one verse re-renders only that
 * VerseCard.
 *
 * Shares the `sgs-reader-notes__v1` localStorage key with NotesProvider.
 */

import type { VerseNote } from "./types";

const STORAGE_KEY = "sgs-reader-notes__v1";

let notes: Map<string, VerseNote> = new Map();
const subscribers = new Set<() => void>();

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, VerseNote>;
    if (parsed && typeof parsed === "object") {
      notes = new Map(Object.entries(parsed));
    }
  } catch {
    notes = new Map();
  }
}

function persist() {
  try {
    const obj: Record<string, VerseNote> = {};
    for (const [k, v] of notes) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Quota / private mode — non-fatal.
  }
}

function notify() {
  for (const fn of subscribers) fn();
}

hydrate();

export const notesStore = {
  subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  getSnapshot(): Record<string, VerseNote> {
    const obj: Record<string, VerseNote> = {};
    for (const [k, v] of notes) obj[k] = v;
    return obj;
  },
  getServerSnapshot(): Record<string, VerseNote> {
    return {};
  },
  get(verseId: string): VerseNote | undefined {
    return notes.get(verseId);
  },
  set(verseId: string, text: string): void {
    // Store raw text on every keystroke — trimming happens on blur/save
    // so users can type spaces freely (fixes item 1).
    notes.set(verseId, { verseId, text, updatedAt: Date.now() });
    persist();
    notify();
  },
  /** Save (blur handler): trim the text and delete the note when empty. */
  save(verseId: string, text: string): void {
    const trimmed = text.trim();
    if (trimmed === "") {
      notes.delete(verseId);
    } else {
      notes.set(verseId, { verseId, text: trimmed, updatedAt: Date.now() });
    }
    persist();
    notify();
  },
  remove(verseId: string): void {
    notes.delete(verseId);
    persist();
    notify();
  },
};
