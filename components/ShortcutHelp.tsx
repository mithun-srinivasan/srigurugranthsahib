/**
 * components/ShortcutHelp.tsx
 * ---------------------------------------------------------------------------
 * The keyboard-shortcut help modal (feature 23): press `?` anywhere to open a
 * full-screen list of every shortcut the app understands.
 *
 * Accessibility (item 25):
 *   - Focus trap: when open, focus is trapped inside the modal (Tab cycles
 *     within the close button).
 *   - Focus restore: on close, focus returns to the element that had it.
 *   - Esc closes; outside-click closes.
 *   - Single-key shortcuts are disabled when `isShortcutsEnabled` is false
 *     (a new ReaderPrefs flag, default true).
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import { SHORTCUTS } from "@/lib/shortcuts";
import { useReaderPrefs } from "./ReaderPrefsProvider";

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { isShortcutsEnabled } = useReaderPrefs();
  /** The element that had focus before the modal opened — for focus restore. */
  const previousFocusRef = useRef<HTMLElement | null>(null);
  /** Ref to the close button (initial focus target inside the modal). */
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // -- Global keyboard listener: `?` help + single-letter navigation ----------

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Never hijack keys while the user is typing in a form field.
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (event.key === "Escape") {
        if (open) setOpen(false);
        return;
      }
      if (!isShortcutsEnabled) return;
      if (isEditable) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      switch (event.key) {
        case "?":
          event.preventDefault();
          setOpen((o) => !o);
          break;
        case "h":
          router.push("/");
          break;
        case "b":
          router.push("/bookmarks");
          break;
        case "s":
          router.push("/search");
          break;
        case "f":
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        default:
          break;
      }
    },
    [open, router, isShortcutsEnabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // -- Focus trap + restore --------------------------------------------------

  useEffect(() => {
    if (!open) return;

    // Record the previously focused element so we can restore focus on close.
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the close button so the modal is immediately keyboard-reachable.
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Only one focusable element (the close button), so Tab is a no-op
      // inside the modal — but we prevent default to keep the trap explicit.
      e.preventDefault();
      closeButtonRef.current?.focus();
    };

    const modal = document.querySelector('[role="dialog"]') as HTMLElement | null;
    modal?.addEventListener("keydown", handleTab as EventListener);
    return () => {
      modal?.removeEventListener("keydown", handleTab as EventListener);
      // Restore focus to the element that had it before the modal opened.
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-popover)] animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Keyboard size={18} className="text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--text)]">Keyboard Shortcuts</h2>
        </div>

        <ul className="space-y-3">
          {SHORTCUTS.map(({ keys, description }) => (
            <li key={keys} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-[var(--text-muted)]">{description}</span>
              <kbd className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--accent)]">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>

        <button
          ref={closeButtonRef}
          onClick={() => setOpen(false)}
          autoFocus
          className="mt-6 w-full rounded-lg bg-[var(--accent)] py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97]"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
