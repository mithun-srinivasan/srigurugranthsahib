/**
 * components/BookmarksProvider.tsx
 * ---------------------------------------------------------------------------
 * React context + provider for user-saved verse bookmarks.
 *
 * On mount it hydrates from `localStorage` (`sgs-reader-bookmarks`) and then
 * debounces writes (500 ms) back to storage on every change. A `Set` ref
 * of verse ids is kept in lock-step with the array state so that `isBookmarked`
 * lookups are O(1) on every render.
 *
 * Migrated to use the shared `lib/persist.ts` helper for:
 *   - Runtime validation with bad-item dropping
 *   - Versioned storage keys
 *   - 500ms debounce + immediate flush on pagehide/visibilitychange
 *   - Quota error surfacing
 *
 * Consume with the `useBookmarks()` hook from any client component.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { Bookmark } from "@/lib/types";
import { createPersistHook, createValidator, validateArray, validateString, validateNumber, validateStringArray, validateOptional } from "@/lib/persist";

/** localStorage key where bookmarks are persisted. */
const STORAGE_KEY = "sgs-reader-bookmarks";

/** The public API of this context: bookmark state + actions + import/export. */
interface BookmarksContextValue {
  bookmarks: Bookmark[];
  isBookmarked: (verseId: string) => boolean;
  toggleBookmark: (b: Omit<Bookmark, "savedAt">) => void;
  removeBookmark: (verseId: string) => void;
  /** Adds a tag to a bookmark (deduplicates; preserves order). */
  addTag: (verseId: string, tag: string) => void;
  /** Removes a tag from a bookmark. */
  removeTag: (verseId: string, tag: string) => void;
  /** All unique tags in use across bookmarks, sorted alphabetically. */
  allTags: string[];
  exportBookmarks: () => void;
  importBookmarks: (json: string) => boolean;
  /** Hydration state. */
  hydrated: boolean;
  /** Quota error signal (storage full / not saved). */
  quotaError: Error | null;
}

/** Internal context — `null` before the provider is mounted. */
const BookmarksContext = createContext<BookmarksContextValue | null>(null);

/** Validator for a single Bookmark. */
function validateBookmark(raw: unknown): { ok: true; data: Bookmark } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "bookmark: not an object" };
  }
  const obj = raw as Record<string, unknown>;

  const verseIdResult = validateString(obj.verseId, "bookmark.verseId", { minLength: 1 });
  if (!verseIdResult.ok) return verseIdResult;

  const angNumberResult = validateNumber(obj.angNumber, "bookmark.angNumber", { integer: true, min: 1, max: 1430 });
  if (!angNumberResult.ok) return angNumberResult;

  const gurmukhiSnippetResult = validateString(obj.gurmukhiSnippet, "bookmark.gurmukhiSnippet");
  if (!gurmukhiSnippetResult.ok) return gurmukhiSnippetResult;

  const savedAtResult = validateNumber(obj.savedAt, "bookmark.savedAt", { integer: true, min: 0 });
  if (!savedAtResult.ok) return savedAtResult;

  const tagsResult = validateOptional(obj.tags, (v) => validateStringArray(v, "bookmark.tags"), "bookmark.tags");
  const tags = tagsResult.ok ? tagsResult.data : undefined;

  const baniResult = validateOptional(obj.bani, (v) => validateString(v, "bookmark.bani"), "bookmark.bani");
  if (!baniResult.ok) return baniResult;
  const bani = baniResult.data;

  return {
    ok: true,
    data: {
      verseId: verseIdResult.data,
      angNumber: angNumberResult.data,
      gurmukhiSnippet: gurmukhiSnippetResult.data,
      savedAt: savedAtResult.data,
      tags,
      bani,
    } satisfies Bookmark,
  };
}

/** Validator for the full bookmarks array. */
const bookmarksValidator = createValidator<Bookmark[]>(1, (raw: unknown) => {
  const result = validateArray(raw, validateBookmark, "bookmarks");
  if (!result.ok) return { ok: true, data: [] as Bookmark[] };
  return { ok: true, data: result.data };
});

/** Persisted slice hook for bookmarks. */
const usePersistedBookmarks = createPersistHook<Bookmark[]>({
  key: STORAGE_KEY,
  validator: bookmarksValidator,
  defaultValue: [],
});

export function BookmarksProvider({ children }: { children: ReactNode }) {
  /** Ordered list of bookmarks (newest first). */
  const [bookmarks, setBookmarks, hydrated, quotaError] = usePersistedBookmarks();

  /** Maintains a `Set` of verse ids that stays in sync with `bookmarks`
   *  (lazily initialised exactly once; the argument is never re-evaluated). */
  const bookmarkSet = useRef<Set<string> | null>(null);
  if (bookmarkSet.current === null) {
    bookmarkSet.current = new Set(bookmarks.map((b) => b.verseId));
  }

  useEffect(() => {
    bookmarkSet.current = new Set(bookmarks.map((b) => b.verseId));
  }, [bookmarks]);

  /** Returns `true` if the given verse id is currently bookmarked. */
  const isBookmarked = useCallback(
    (verseId: string) => bookmarkSet.current?.has(verseId) ?? false,
    []
  );

  /**
   * Toggles a bookmark: if it already exists it is removed; if not, it is
   * prepended (newest-first) with `savedAt` stamped to `Date.now()`.
   */
  const toggleBookmark = useCallback(
    (b: Omit<Bookmark, "savedAt">) => {
      setBookmarks((prev) => {
        const exists = prev.some((x) => x.verseId === b.verseId);
        const next = exists
          ? prev.filter((x) => x.verseId !== b.verseId)
          : [{ ...b, savedAt: Date.now() }, ...prev];
        // Update the Set ref synchronously so the next render is consistent.
        bookmarkSet.current = new Set(next.map((x) => x.verseId));
        return next;
      });
    },
    [setBookmarks]
  );

  /** Removes a single bookmark by its verse id. */
  const removeBookmark = useCallback((verseId: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((x) => x.verseId !== verseId);
      bookmarkSet.current = new Set(next.map((x) => x.verseId));
      return next;
    });
  }, [setBookmarks]);

  /** Adds (deduplicated) a tag to the given bookmark. */
  const addTag = useCallback((verseId: string, tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    setBookmarks((prev) =>
      prev.map((b) =>
        b.verseId === verseId
          ? { ...b, tags: [...new Set([...(b.tags ?? []), clean])] }
          : b
      )
    );
  }, [setBookmarks]);

  /** Removes a tag from the given bookmark. */
  const removeTag = useCallback((verseId: string, tag: string) => {
    setBookmarks((prev) =>
      prev.map((b) =>
        b.verseId === verseId
          ? { ...b, tags: (b.tags ?? []).filter((t) => t !== tag) }
          : b
      )
    );
  }, [setBookmarks]);

  // -- JSON export / import --------------------------------------------------

  /**
   * Exports all bookmarks as a timestamped JSON file download.
   * Creates a temporary `<a>` element, clicks it, then revokes the object URL.
   */
  const exportBookmarks = useCallback(() => {
    const data = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sggs-reader-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [bookmarks]);

  /**
   * Imports bookmarks from a raw JSON string.
   * Validates that the input is an array of objects with the required fields
   * (angNumber integer 1–1430, verseId non-empty string, tags string[]),
   * then merges any new verses (by verseId) with the existing list.
   *
   * @returns `true` on success, `false` on any validation/parse error.
   */
  const importBookmarks = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return false;

      // Validate the shape of every item in the array using the same validator.
      const result = validateArray(parsed, validateBookmark, "imported bookmarks");
      if (!result.ok || result.data.length === 0) return false;

      const imported = result.data;
      setBookmarks((prev) => {
        const existingIds = new Set(prev.map((b) => b.verseId));
        const merged = [
          // Imported items that are not already present, with safe defaults.
          ...imported
            .filter((b) => !existingIds.has(b.verseId))
            .map((b) => ({ ...b, savedAt: b.savedAt ?? Date.now() })),
          ...prev,
        ];
        bookmarkSet.current = new Set(merged.map((b) => b.verseId));
        return merged;
      });
      return true;
    } catch {
      return false; // malformed JSON
    }
  }, [setBookmarks]);

  const value = useMemo(() => {
    const tagSet = new Set<string>();
    for (const b of bookmarks) {
      for (const t of b.tags ?? []) tagSet.add(t);
    }
    const allTags = [...tagSet].sort((a, b) => a.localeCompare(b));
    return {
      bookmarks,
      isBookmarked,
      toggleBookmark,
      removeBookmark,
      addTag,
      removeTag,
      allTags,
      exportBookmarks,
      importBookmarks,
      hydrated,
      quotaError,
    };
  }, [
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    addTag,
    removeTag,
    exportBookmarks,
    importBookmarks,
    hydrated,
    quotaError,
  ]);

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

/**
 * Accessor hook for the bookmarks context.
 * Throws if called outside a `<BookmarksProvider>` tree.
 */
export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error("useBookmarks must be used within BookmarksProvider");
  return ctx;
}