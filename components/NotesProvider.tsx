/**
 * components/NotesProvider.tsx
 * ---------------------------------------------------------------------------
 * Context + provider for **verse notes** (feature 10): users can attach a short
 * reflection/annotation to any verse. Notes are stored per verse id under
 * `localStorage` (`sgs-reader-notes`), hydrated on mount, and persisted with a
 * 500 ms debounce — using the shared `lib/persist.ts` helper.
 *
 * Key fix: `setNote` no longer trims on every keystroke. Raw text is stored;
 * trimming happens only on blur (via `saveNote`) and the note is deleted only
 * when the trimmed text is empty on blur.
 *
 * Consume with `useVerseNotes()`.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { VerseNote } from "@/lib/types";
import { createPersistHook, createValidator, validateArray, validateString, validateNumber } from "@/lib/persist";

/** localStorage key under which verse notes are persisted. */
const STORAGE_KEY = "sgs-reader-notes";

/** Validator for a single VerseNote. */
function validateVerseNote(raw: unknown) {
  return validateArray(raw, (item) => {
    if (typeof item !== "object" || item === null) {
      return { ok: false, reason: "note: not an object" };
    }
    const obj = item as Record<string, unknown>;

    const verseIdResult = validateString(obj.verseId, "note.verseId", { minLength: 1 });
    if (!verseIdResult.ok) return verseIdResult;

    const textResult = validateString(obj.text, "note.text");
    if (!textResult.ok) return textResult;

    const updatedAtResult = validateNumber(obj.updatedAt, "note.updatedAt", { integer: true, min: 0 });
    if (!updatedAtResult.ok) return updatedAtResult;

    return {
      ok: true,
      data: {
        verseId: verseIdResult.data,
        text: textResult.data,
        updatedAt: updatedAtResult.data,
      } satisfies VerseNote,
    };
  }, "notes");
}

/** Validator for the full notes array. */
const notesValidator = createValidator<VerseNote[]>(1, (raw: unknown) => {
  const result = validateVerseNote(raw);
  if (!result.ok) return { ok: true, data: [] as VerseNote[] };
  return { ok: true, data: result.data };
});

/** Persisted slice hook for notes. */
const usePersistedNotes = createPersistHook<VerseNote[]>({
  key: STORAGE_KEY,
  validator: notesValidator,
  defaultValue: [],
});

/** Public context API. */
interface NotesContextValue {
  notes: VerseNote[];
  /** Returns the note attached to a verse, or `undefined`. */
  getNote: (verseId: string) => VerseNote | undefined;
  /**
   * Sets the raw note text for a verse (called on every keystroke).
   * Does NOT trim — raw input is stored.
   */
  setNote: (verseId: string, text: string) => void;
  /**
   * Saves the note with trimming applied.
   * Call on blur or explicit save. Deletes the note if trimmed text is empty.
   */
  saveNote: (verseId: string, text: string) => void;
  /** Deletes the note for a verse, if any. */
  removeNote: (verseId: string) => void;
  /** Hydration state. */
  hydrated: boolean;
  /** Quota error signal (storage full / not saved). */
  quotaError: Error | null;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes, hydrated, quotaError, forceFlush] = usePersistedNotes();

  const getNote = useCallback(
    (verseId: string) => notes.find((n) => n.verseId === verseId),
    [notes]
  );

  // Raw setNote — stores text as-is, no trimming.
  const setNote = useCallback((verseId: string, text: string) => {
    setNotes((prev) => {
      const existing = prev.find((n) => n.verseId === verseId);
      if (existing) {
        return prev.map((n) =>
          n.verseId === verseId ? { ...n, text, updatedAt: Date.now() } : n
        );
      }
      return [{ verseId, text, updatedAt: Date.now() }, ...prev];
    });
  }, [setNotes]);

  // saveNote — trims and persists; deletes if empty after trim.
  const saveNote = useCallback((verseId: string, text: string) => {
    const trimmed = text.trim();
    setNotes((prev) => {
      if (!trimmed) return prev.filter((n) => n.verseId !== verseId);
      const existing = prev.find((n) => n.verseId === verseId);
      if (existing) {
        return prev.map((n) =>
          n.verseId === verseId ? { ...n, text: trimmed, updatedAt: Date.now() } : n
        );
      }
      return [{ verseId, text: trimmed, updatedAt: Date.now() }, ...prev];
    });
  }, [setNotes]);

  const removeNote = useCallback((verseId: string) => {
    setNotes((prev) => prev.filter((n) => n.verseId !== verseId));
  }, [setNotes]);

  const value = useMemo(
    () => ({ notes, getNote, setNote, saveNote, removeNote, hydrated, quotaError }),
    [notes, getNote, setNote, saveNote, removeNote, hydrated, quotaError]
  );

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  );
}

export function useVerseNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useVerseNotes must be used within NotesProvider");
  return ctx;
}