/**
 * app/bookmarks/page.tsx
 * ---------------------------------------------------------------------------
 * Displays all user-saved verse bookmarks in a scrollable list.
 *
 * Features:
 *   - Each bookmark shows its Ang number, Gurmukhi snippet, and saved date.
 *   - Tapping a bookmark deep-links to `/ang/N#verseId` in the reader.
 *   - A remove button (BookmarkX icon) deletes the bookmark.
 *   - **Folders/tags (feature 11):** assign tags to any bookmark, filter the
 *     list by tag, and see a tag chip row at the top.
 *   - **Print (feature 15):** `print` button renders a clean printed list;
 *     `@media print` CSS hides the interactive chrome.
 *   - Export / Import bookmarks as timestamped JSON.
 *   - **Full backup (data safety):** one file with bookmarks + notes +
 *     highlights + progress + preferences + reminder choices
 *     (`lib/backup.ts`), since every slice is browser-local with no
 *     account. Device-to-device transfer without a server uses the same
 *     envelope over WebRTC at `/sync`. Restoring reloads
 *     the page so all providers rehydrate.
 *   - A theme toggle cycles through Light → Dark → Sepia (3-way cycle).
 *
 * Data is managed entirely by `BookmarksProvider` (localStorage-backed).
 */

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  BookmarkX,
  ArrowRight,
  Sun,
  Moon,
  Coffee,
  Download,
  Upload,
  Printer,
  Tag,
  X,
} from "lucide-react";
import { useBookmarks } from "@/components/BookmarksProvider";
import { useReaderPrefs } from "@/components/ReaderPrefsProvider";
import { downloadBackup, restoreBackup, lastBackupAt } from "@/lib/backup";
import { getBaniName } from "@/lib/nitnem";

export default function BookmarksPage() {
  const { bookmarks, removeBookmark, addTag, removeTag, allTags, exportBookmarks, importBookmarks } =
    useBookmarks();
  const prefs = useReaderPrefs();

  /** Hidden file input ref — clicked programmatically via the Upload button. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Hidden file input for full-backup restore files. */
  const backupInputRef = useRef<HTMLInputElement>(null);

  /** Import feedback state: "idle" → "success"/"error" → "idle" (after 3s). */
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");

  /** Full-backup restore feedback + last-backup timestamp. */
  const [backupStatus, setBackupStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-mount hydration from localStorage
    setLastBackup(lastBackupAt());
  }, []);

  /** Currently active tag filter (`null` = show everything). */
  const [activeTag, setActiveTag] = useState<string | null>(null);

  /** Which bookmark's tag editor is open. */
  const [tagEditorId, setTagEditorId] = useState<string | null>(null);

  /** Per-editor draft tag text. */
  const [tagDraft, setTagDraft] = useState("");

  /** Import-feedback timer handle — cancelled on unmount. */
  const importTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (importTimer.current) clearTimeout(importTimer.current);
    },
    []
  );

  /** Unique tags in use (already sorted by the provider). */
  const tags = allTags;

  /** Bookmarks after applying the tag filter. */
  const visible = activeTag
    ? bookmarks.filter((b) => (b.tags ?? []).includes(activeTag))
    : bookmarks;

  // -- Export handler: triggers the BookmarksProvider's download --------------

  const handleExport = () => exportBookmarks();

  // -- Import handler: reads a user-selected JSON file ------------------------

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setImportStatusSoon = (status: "success" | "error") => {
      setImportStatus(status);
      if (importTimer.current) clearTimeout(importTimer.current);
      importTimer.current = setTimeout(() => setImportStatus("idle"), 3000);
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const success = importBookmarks(text);
      setImportStatusSoon(success ? "success" : "error");
    };
    reader.readAsText(file);

    // Reset the input so the same file can be re-imported if needed.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Commits the draft tag to the bookmark whose editor is open. */
  const commitTag = (verseId: string) => {
    addTag(verseId, tagDraft);
    setTagDraft("");
  };

  // -- Full backup: all local slices in one file (see lib/backup.ts) ----------

  const handleBackupExport = () => {
    downloadBackup();
    setLastBackup(lastBackupAt());
  };

  const handleBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const restored = restoreBackup(event.target?.result as string);
      if (restored > 0) {
        setBackupStatus("success");
        // Providers hydrate once on mount — reload so every restored slice applies.
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setBackupStatus("error");
        if (importTimer.current) clearTimeout(importTimer.current);
        importTimer.current = setTimeout(() => setBackupStatus("idle"), 3000);
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = "";
  };

  // -- Theme cycle: Light → Dark → Sepia → Light ----------------------------

  const nextTheme = prefs.theme === "light" ? "dark" : prefs.theme === "dark" ? "sepia" : "light";
  const ThemeIcon = prefs.theme === "light" ? Sun : prefs.theme === "dark" ? Moon : Coffee;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors">
      {/* Sticky header with back link, title, export/import, and theme toggle */}
      <header className="print-hide sticky top-0 z-30 border-b bg-[var(--bg)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to home"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-sm font-bold text-[var(--text)]">
              Saved Verses ({bookmarks.length})
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Print button — opens the browser print dialog */}
            <button
              onClick={() => window.print()}
              aria-label="Print bookmarks"
              title="Print bookmarks"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] transition"
            >
              <Printer size={16} />
            </button>

            {/* Export button — downloads all bookmarks as a JSON file */}
            <button
              onClick={handleExport}
              aria-label="Export bookmarks"
              title="Export bookmarks to JSON"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] transition"
            >
              <Download size={16} />
            </button>

            {/* Import button — opens a file picker for a .json file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Import bookmarks"
              title="Import bookmarks from JSON"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] transition"
            >
              <Upload size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />

            {/* 3-way theme toggle: Light → Dark → Sepia → Light */}
            <button
              onClick={() => prefs.setTheme(nextTheme)}
              aria-label={`Switch to ${nextTheme} theme`}
              title={`Switch to ${nextTheme} theme`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] transition"
            >
              <ThemeIcon size={16} />
            </button>
          </div>
        </div>

        {/* Tag filter row (feature 11) */}
        {tags.length > 0 && (
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
            <button
              onClick={() => setActiveTag(null)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                activeTag === null
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              All
            </button>
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag((cur) => (cur === t ? null : t))}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  activeTag === t
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        {/* Full-backup reminder: everything is browser-local, no account/sync */}
        <section
          aria-label="Full data backup"
          className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xs font-bold text-[var(--text)]">
                Back up your data
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Bookmarks, notes, highlights, progress, settings, and reminder
                choices live only in this browser.{" "}
                {lastBackup
                  ? `Last full backup: ${new Date(lastBackup).toLocaleDateString()}.`
                  : "No full backup yet — export one now."}{" "}
                <Link href="/sync" className="font-semibold text-[var(--accent)] hover:underline">
                  Sync to another device
                </Link>
                .
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleBackupExport}
                aria-label="Download full backup"
                title="Download bookmarks + notes + highlights + progress + settings + reminders"
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                <Download size={14} />
                <span>Back up all</span>
              </button>
              <button
                onClick={() => backupInputRef.current?.click()}
                aria-label="Restore full backup"
                title="Restore from a backup file (reloads the page)"
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--surface-hover)] active:scale-[0.97]"
              >
                <Upload size={14} />
                <span>Restore</span>
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                onChange={handleBackupImport}
                className="hidden"
              />
            </div>
          </div>
          {backupStatus === "success" && (
            <p className="mt-3 rounded-lg bg-[var(--accent-light)] px-3 py-2 text-[11px] font-medium text-[var(--accent)]">
              Backup restored — reloading with your data…
            </p>
          )}
          {backupStatus === "error" && (
            <p className="mt-3 rounded-lg bg-[var(--accent-light)] px-3 py-2 text-[11px] font-medium text-[var(--text-muted)]">
              Invalid backup file. Please choose a file exported with “Back up all”.
            </p>
          )}
        </section>

        {/* Import success / error banners */}
        {importStatus === "success" && (
          <div className="mb-4 rounded-lg bg-[var(--accent-light)] px-4 py-2 text-xs font-medium text-[var(--accent)]">
            Bookmarks imported successfully!
          </div>
        )}
        {importStatus === "error" && (
          <div className="mb-4 rounded-lg bg-[var(--accent-light)] px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
            Invalid file format. Please upload a valid JSON file.
          </div>
        )}

        {/* Empty state */}
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)]">
              <BookmarkIcon size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[var(--text)]">No Bookmarks Saved Yet</h2>
              <p className="max-w-xs text-xs text-[var(--text-muted)] leading-relaxed">
                Tap the bookmark icon under any verse while reading to save it here.
              </p>
            </div>
            <Link
              href="/ang/1"
              className="mt-2 flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <span>Read Ang 1</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-xs text-[var(--text-muted)]">
            No bookmarks tagged “{activeTag}”.
          </p>
        ) : (
          /* Bookmarks list */
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {visible.map((b) => (
              <li key={b.verseId} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  {/* Tapping navigates directly to the verse in the reader
                      (bani bookmarks deep-link to the Nitnem page instead). */}
                  <Link
                    href={b.bani ? `/nitnem/${b.bani}#${b.verseId}` : `/ang/${b.angNumber}#${b.verseId}`}
                    className="block transition hover:opacity-80"
                  >
                    <span className="text-xs font-bold text-[var(--accent)]">
                      {b.bani ? getBaniName(b.bani) : `Ang ${b.angNumber}`} ·{" "}
                      {new Date(b.savedAt).toLocaleDateString()}
                    </span>
                    <p className="font-gurmukhi text-lg font-semibold leading-relaxed text-[var(--text)] truncate mt-1">
                      {b.gurmukhiSnippet}
                    </p>
                  </Link>

                  {/* Tag chips + editor (hidden when printing) */}
                  <div className="print-hide mt-2 flex flex-wrap items-center gap-1.5">
                    {(b.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]"
                      >
                        {t}
                        <button
                          onClick={() => removeTag(b.verseId, t)}
                          aria-label={`Remove tag ${t}`}
                          className="hover:text-[var(--text)]"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}

                    {tagEditorId === b.verseId ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          commitTag(b.verseId);
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          placeholder="Add tag…"
                          autoFocus
                          className="h-6 w-24 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          className="text-[10px] font-semibold text-[var(--accent)]"
                        >
                          Add
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setTagEditorId(b.verseId);
                          setTagDraft("");
                        }}
                        className="flex items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent)] transition"
                      >
                        <Tag size={10} />
                        Tag
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeBookmark(b.verseId)}
                  aria-label="Remove bookmark"
                  title="Remove Bookmark"
                  className="print-hide flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] transition"
                >
                  <BookmarkX size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}