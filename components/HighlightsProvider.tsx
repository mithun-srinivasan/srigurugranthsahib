/**
 * components/HighlightsProvider.tsx
 * ---------------------------------------------------------------------------
 * Context + provider for **multi-colour verse highlights** (feature 12).
 *
 * A user can highlight any verse in one of four colours (Saffron, Green, Blue,
 * Rose). The chosen colour is stored per verse id under `localStorage`
 * (`sgs-reader-highlights`) with the usual hydration + 500 ms debounce so the
 * emphasised pickups persist across sessions.
 *
 * Migrated to use the shared `lib/persist.ts` helper for:
 *   - Runtime validation with bad-item dropping
 *   - Versioned storage keys
 *   - 500ms debounce + immediate flush on pagehide/visibilitychange
 *   - Quota error surfacing
 *
 * Consume with `useHighlights()`.
 */

"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { HighlightColor } from "@/lib/types";
import { createPersistHook, createValidator, validateRecord, validateString } from "@/lib/persist";

/** localStorage key under which highlights are persisted. */
const STORAGE_KEY = "sgs-reader-highlights";

/** The four pickable highlight colours. */
export const HIGHLIGHT_COLORS: HighlightColor[] = ["saffron", "green", "blue", "rose"];

/** Public context API. */
interface HighlightsContextValue {
  /** Map of verseId → highlight colour. */
  highlights: Record<string, HighlightColor>;
  /** The highlight colour for a verse, or `undefined` when unhighlighted. */
  getHighlight: (verseId: string) => HighlightColor | undefined;
  /** Toggles a colour on a verse; calling again with the same colour removes it. */
  toggleHighlight: (verseId: string, color: HighlightColor) => void;
  /** Removes every highlight (used from the home-page stats card). */
  clearAll: () => void;
  /** Hydration state. */
  hydrated: boolean;
  /** Quota error signal (storage full / not saved). */
  quotaError: Error | null;
}

const HighlightsContext = createContext<HighlightsContextValue | null>(null);

/** Validator for a single highlight color value. */
function validateHighlightColor(raw: unknown): { ok: true; data: HighlightColor } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "highlight: not a string" };
  if (!HIGHLIGHT_COLORS.includes(raw as HighlightColor)) {
    return { ok: false, reason: `highlight: invalid color ${raw}` };
  }
  return { ok: true, data: raw as HighlightColor };
}

/** Validator for the full highlights record. */
const highlightsValidator = createValidator<Record<string, HighlightColor>>(1, (raw: unknown) => {
  const result = validateRecord(raw, validateHighlightColor, "highlights");
  if (!result.ok) return { ok: true, data: {} as Record<string, HighlightColor> };
  return { ok: true, data: result.data };
});

/** Persisted slice hook for highlights. */
const usePersistedHighlights = createPersistHook<Record<string, HighlightColor>>({
  key: STORAGE_KEY,
  validator: highlightsValidator,
  defaultValue: {},
});

export function HighlightsProvider({ children }: { children: ReactNode }) {
  const [highlights, setHighlights, hydrated, quotaError] = usePersistedHighlights();

  const getHighlight = useCallback(
    (verseId: string) => highlights[verseId],
    [highlights]
  );

  const toggleHighlight = useCallback((verseId: string, color: HighlightColor) => {
    setHighlights((prev) => {
      const next = { ...prev };
      if (next[verseId] === color) delete next[verseId];
      else next[verseId] = color;
      return next;
    });
  }, [setHighlights]);

  const clearAll = useCallback(() => setHighlights({}), [setHighlights]);

  const value = useMemo(
    () => ({ highlights, getHighlight, toggleHighlight, clearAll, hydrated, quotaError }),
    [highlights, getHighlight, toggleHighlight, clearAll, hydrated, quotaError]
  );

  return (
    <HighlightsContext.Provider value={value}>
      {children}
    </HighlightsContext.Provider>
  );
}

export function useHighlights() {
  const ctx = useContext(HighlightsContext);
  if (!ctx) throw new Error("useHighlights must be used within HighlightsProvider");
  return ctx;
}