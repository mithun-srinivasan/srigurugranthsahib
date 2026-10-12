/**
 * lib/offline-search.ts
 * ---------------------------------------------------------------------------
 * Offline search over Angs the reader has already visited (feature: offline
 * search).
 *
 * Full-text search across all 1,430 Angs needs the live BaniDB API, so it
 * cannot work offline without bundling tens of megabytes of scripture. This
 * module is the honest middle ground: every Ang rendered by `ClientAngReader`
 * is trimmed (Gurmukhi + English only) into a capped localStorage index, and
 * the search page falls back to substring-matching that index when the
 * network is unreachable — clearly labelled as "Offline results".
 *
 * Deliberately excluded from `BACKUP_KEYS`: like the `sggs-sgpc-*` calendar
 * cache, this is re-derivable remote data, not user data — re-reading the
 * Angs rebuilds it.
 */

import type { SearchResult, VerseLine } from "./types";

/** localStorage key holding the visited-Ang verse index. */
const INDEX_KEY = "sgs-reader-offline-index";

/** localStorage key holding the most recent successful search terms. */
const RECENT_KEY = "sgs-reader-recent-searches";

/** Cap on indexed Angs — bounds localStorage well under the ~5 MB quota. */
const MAX_INDEXED_ANGS = 60;

/** Cap on remembered recent search terms. */
const MAX_RECENT = 10;

/** Cap on offline results surfaced to the UI (mirrors the online cap). */
const MAX_OFFLINE_RESULTS = 40;

/** One indexed Ang: trimmed verses only, no commentary or metadata. */
export interface OfflineAngEntry {
  ang: number;
  verses: { verseId: string; gurmukhi: string; en?: string }[];
  savedAt: number;
}

/** Reads the whole index; corrupt or missing storage yields `[]`. */
export function readOfflineIndex(): OfflineAngEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OfflineAngEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as OfflineAngEntry).ang === "number" &&
        Array.isArray((e as OfflineAngEntry).verses)
    );
  } catch {
    return [];
  }
}

/** Writes the index; on quota pressure drops the oldest half and retries once. */
function writeOfflineIndex(entries: OfflineAngEntry[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    try {
      const halved = entries.slice(Math.floor(entries.length / 2));
      localStorage.setItem(INDEX_KEY, JSON.stringify(halved));
    } catch {
      // Private mode / full quota — offline search simply stays smaller.
    }
  }
}

/**
 * Indexes one Ang's verses (idempotent — re-reading an Ang refreshes it).
 * Called by `ClientAngReader` as the user reads; never throws.
 */
export function saveAngToOfflineIndex(
  angNumber: number,
  lines: Pick<VerseLine, "verseId" | "gurmukhi" | "translations">[]
): void {
  if (!lines || lines.length === 0) return;
  try {
    const entries = readOfflineIndex().filter((e) => e.ang !== angNumber);
    entries.push({
      ang: angNumber,
      verses: lines.map((l) => ({
        verseId: String(l.verseId),
        gurmukhi: l.gurmukhi,
        en: l.translations?.en ?? undefined,
      })),
      savedAt: Date.now(),
    });
    // Oldest-first eviction keeps the freshest MAX_INDEXED_ANGS Angs.
    entries.sort((a, b) => a.savedAt - b.savedAt);
    writeOfflineIndex(entries.slice(-MAX_INDEXED_ANGS));
  } catch {
    // Indexing must never break reading.
  }
}

/** Totals for the "Offline results · from N Angs" UI label. */
export function offlineIndexStats(): { angs: number; verses: number } {
  const entries = readOfflineIndex();
  return {
    angs: entries.length,
    verses: entries.reduce((n, e) => n + e.verses.length, 0),
  };
}

/** Whitespace-insensitive needle — Gurmukhi spacing varies across sources. */
function squash(s: string): string {
  return s.replace(/\s+/g, "");
}

/**
 * Substring-matches the offline index. `mode` mirrors the search page modes:
 * `"pa"` matches Gurmukhi, `"en"` matches the English translation.
 */
export function searchOfflineIndex(term: string, mode: "pa" | "en"): SearchResult[] {
  const needle = mode === "pa" ? squash(term) : term.trim().toLowerCase();
  if (!needle) return [];
  const out: SearchResult[] = [];
  for (const entry of readOfflineIndex()) {
    for (const v of entry.verses) {
      const haystack =
        mode === "pa" ? squash(v.gurmukhi) : (v.en ?? "").toLowerCase();
      if (haystack && haystack.includes(needle)) {
        out.push({
          verseId: v.verseId,
          angNumber: entry.ang,
          gurmukhi: v.gurmukhi,
          translation: v.en,
        });
        if (out.length >= MAX_OFFLINE_RESULTS) return out;
      }
    }
  }
  return out;
}

/** Remembers a successful search term for the landing-page suggestions. */
export function saveRecentSearch(term: string): void {
  const clean = term.trim();
  if (!clean) return;
  try {
    const prev = readRecentSearches().filter((t) => t !== clean);
    localStorage.setItem(RECENT_KEY, JSON.stringify([clean, ...prev].slice(0, MAX_RECENT)));
  } catch {
    // Non-fatal — recent searches are a convenience only.
  }
}

/** Most recent successful search terms, newest first. */
export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}
