/**
 * app/search/page.tsx
 * ---------------------------------------------------------------------------
 * Full-text search interface for Sri Guru Granth Sahib Ji.
 *
 * Behaviour:
 *   - The user types a Gurmukhi, Roman-letter, or English search term.
 *   - In Gurmukhi mode, Roman keystrokes are transliterated live
 *     (`satinaam` → ਸਤਿਨਾਮ) with a preview of the converted query; existing
 *     Gurmukhi passes through untouched.  In English mode the term is sent
 *     as-is against the translations.
 *   - Pressing Enter or tapping a quick-search suggestion triggers `runSearch`
 *     (a server action that calls BaniDB's `/v2/search` endpoint).
 *   - When the network is unreachable (or the live call times out), the page
 *     falls back to the on-device index of visited Angs
 *     (`lib/offline-search.ts`), clearly labelled as offline results.
 *   - Results are displayed as a list of links that deep-link directly to the
 *     matching Ang and verse fragment (`/ang/N#verseId`).
 *   - While loading, a spinning Loader2 indicator is shown.
 *   - On empty results, a "no results" message is shown with a spelling hint.
 */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Search as SearchIcon, Loader2, X, WifiOff } from "lucide-react";
import type { SearchResult } from "@/lib/types";
import { romanToGurmukhi } from "@/lib/gurmukhi";
import {
  offlineIndexStats,
  readRecentSearches,
  saveRecentSearch,
  searchOfflineIndex,
} from "@/lib/offline-search";
import { runSearch } from "./actions";

/** Search input modes: Gurmukhi (with Roman transliteration) or English. */
type SearchMode = "pa" | "en";

/** True when the term already contains Gurmukhi script (U+0A00-U+0A7F). */
function hasGurmukhi(term: string): boolean {
  return /[\u0A00-\u0A7F]/.test(term);
}

/** Pre-filled quick search suggestions shown when no search has been performed yet. */
const QUICK_SEARCHES = ["ੴ", "ਸਤਿ ਨਾਮੁ", "ਵਾਹਿਗੁਰੂ", "Japji", "Truth", "Guru Nanak"];

export default function SearchPage() {
  /** The raw text in the search input field. */
  const [query, setQuery] = useState("");

  /** Input mode: Gurmukhi (Roman auto-converts) or English translations. */
  const [mode, setMode] = useState<SearchMode>("pa");

  /** The current set of results (may be empty if no matches were found). */
  const [results, setResults] = useState<SearchResult[]>([]);

  /** Whether a search is currently in progress. */
  const [loading, setLoading] = useState(false);

  /** Whether a search has been submitted (used to decide whether to show the landing UI). */
  const [searched, setSearched] = useState(false);

  /** True when the shown results came from the on-device offline index. */
  const [offlineMode, setOfflineMode] = useState(false);

  /** How many Angs the offline index currently covers (for the badge). */
  const [indexedAngs, setIndexedAngs] = useState(0);

  /** Recent successful searches, shown as landing-page shortcuts. */
  const [recent, setRecent] = useState<string[]>([]);

  /** Hydrate offline stats + recents once on mount (SSR-safe). */
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-mount hydration from localStorage
      setIndexedAngs(offlineIndexStats().angs);
      setRecent(readRecentSearches());
    } catch {
      // Storage unavailable — search still works online.
    }
  }, []);

  /**
   * Resolves the submitted term: in Gurmukhi mode, Roman text is converted
   * (existing Gurmukhi passes through); in English mode it is sent as-is.
   */
  const resolveTerm = (term: string): string => {
    const trimmed = term.trim();
    if (mode === "pa" && trimmed && !hasGurmukhi(trimmed)) {
      return romanToGurmukhi(trimmed);
    }
    return trimmed;
  };

  /** Live preview of the converted query (empty when nothing to convert). */
  const preview =
    mode === "pa" && /[a-zA-Z]/.test(query) && !hasGurmukhi(query)
      ? romanToGurmukhi(query.trim())
      : "";

  /**
   * Executes a search for the given term.
   *
   * Online first (bounded by a client timeout so poor mobile networks fail
   * fast instead of spinning); on any failure — or when the browser reports
   * offline — falls back to the on-device index of visited Angs and labels
   * the results as offline. Any failure surfaces an error state instead of
   * leaving the spinner spinning.
   */
  const doSearch = async (term: string) => {
    const resolved = resolveTerm(term);
    if (!resolved) return;
    setQuery(term);
    setLoading(true);
    setSearched(true);
    setOfflineMode(false);

    // Offline fast-path: skip the live call entirely when the browser
    // already knows it has no connection.
    const searchOffline = () => {
      const hits = searchOfflineIndex(resolved, mode);
      setResults(hits);
      setOfflineMode(true);
      setIndexedAngs(offlineIndexStats().angs);
      setLoading(false);
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      searchOffline();
      return;
    }

    try {
      // Client-side bound: the server action already retries upstream, so a
      // slow mobile network would otherwise hold the spinner for ~a minute.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("search timeout")), 15000)
      );
      const res = await Promise.race([runSearch(resolved, mode), timeout]);
      setResults(res);
      saveRecentSearch(resolved);
      setRecent(readRecentSearches());
    } catch {
      // Live search failed — the offline index is the graceful fallback,
      // not an error screen.
      searchOffline();
      return;
    }
    setLoading(false);
  };

  /** Form submission handler — prevents default and delegates to `doSearch`. */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors">
      {/* Sticky header with back link and search input */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
          >
            <ArrowLeft size={18} />
          </Link>

          {/* Script mode toggle */}
          <div
            className="flex shrink-0 items-center rounded-lg border border-[var(--border)] p-0.5"
            role="group"
            aria-label="Search language"
          >
            {(
              [
                { id: "pa", label: "ਗੁਰਮੁਖੀ" },
                { id: "en", label: "ABC" },
              ] as { id: SearchMode; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                title={id === "pa" ? "Gurmukhi (Roman letters convert automatically)" : "English translations"}
                className={`min-h-[40px] px-2.5 text-xs font-semibold transition rounded ${
                  mode === id
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 items-center">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--accent)]">
              <SearchIcon size={18} className="text-[var(--text-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  mode === "pa"
                    ? "Type Gurmukhi or Roman letters (satinaam → ਸਤਿਨਾਮ)..."
                    : "Search English translations..."
                }
                className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {/* Clear button — only visible when the input is non-empty */}
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    setSearched(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        {/* Live transliteration preview (Gurmukhi mode, Roman input). */}
        {preview && preview !== query.trim() && !loading && (
          <p className="mb-4 text-center text-xs text-[var(--text-muted)]">
            Will search:{" "}
            <span dir="auto" lang="pa" className="font-gurmukhi text-sm font-semibold text-[var(--accent)]">
              {preview}
            </span>
          </p>
        )}

        {/* Landing state — shown before any search has been performed */}
        {!searched && (
          <div className="py-8 space-y-6 text-center">
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">Search Across All 1430 Angs</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Type Gurmukhi directly, Roman letters (auto-converted), or switch to ABC for English.
              </p>
            </div>

            {/* Quick-search suggestion chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {QUICK_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => doSearch(term)}
                  className="min-h-[40px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Recent searches (from successful online searches on this device) */}
            {recent.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                  Recent
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {recent.map((term) => (
                    <button
                      key={term}
                      onClick={() => doSearch(term)}
                      className="min-h-[36px] rounded-lg border border-dashed border-[var(--border)] px-3 text-xs text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Offline index footprint */}
            {indexedAngs > 0 && (
              <p className="text-[11px] text-[var(--text-faint)]">
                {indexedAngs} {indexedAngs === 1 ? "Ang" : "Angs"} available for offline search
              </p>
            )}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
            <Loader2 size={22} className="animate-spin text-[var(--accent)]" />
            <span className="text-xs font-semibold">Searching...</span>
          </div>
        )}

        {/* Empty results — online wording, or offline wording when the
            on-device index had nothing (with a nudge to read more Angs). */}
        {!loading && searched && results.length === 0 && (
          <div className="py-16 text-center space-y-1">
            <p className="text-sm font-semibold text-[var(--text)]">No results for &ldquo;{query}&rdquo;</p>
            {offlineMode ? (
              <p className="text-xs text-[var(--text-muted)]">
                Offline search covers {indexedAngs} {indexedAngs === 1 ? "Ang" : "Angs"} you have
                read. Reconnect for the full 1,430-Ang search, or read more Angs to grow the
                offline index.
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Try a shorter search term or check spelling.</p>
            )}
          </div>
        )}

        {/* Search results */}
        {!loading && results.length > 0 && (
          <div className="space-y-4">
            {offlineMode ? (
              <p
                role="status"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-semibold text-[var(--text-muted)]"
              >
                <WifiOff size={13} className="text-[var(--accent)]" />
                <span>
                  Offline results · from {indexedAngs} {indexedAngs === 1 ? "Ang" : "Angs"} you
                  have read
                </span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                Found {results.length} verses
              </p>
            )}

            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {results.map((r) => (
                <li key={r.verseId}>
                  <Link
                    href={`/ang/${r.angNumber}#${r.verseId}`}
                    className="block py-4 transition hover:bg-[var(--surface-hover)]"
                  >
                    <span className="text-xs font-bold text-[var(--accent)]">Ang {r.angNumber}</span>
                    <p className="font-gurmukhi text-lg font-semibold leading-relaxed text-[var(--text)] mt-1">
                      {r.gurmukhi}
                    </p>
                    {r.translation && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{r.translation}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
