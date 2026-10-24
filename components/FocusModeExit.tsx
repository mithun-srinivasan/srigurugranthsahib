/**
 * components/FocusModeExit.tsx
 * ---------------------------------------------------------------------------
 * Small floating button that lets a reader exit Focus Mode.
 *
 * Only renders when `isFocusMode` is true. It is always visible (not subject
 * to the NavigationBar's auto-hide), keyboard-reachable (tabbable, onClick),
 * and works on touch (onClick fires on tap). Clicking toggles focus mode off
 * via `ReaderPrefsProvider`, which removes `data-focus-mode="on"` from <html>
 * and restores the normal top/bottom bars.
 */

"use client";

import { useReaderPrefs } from "./ReaderPrefsProvider";
import { X } from "lucide-react";

export default function FocusModeExit() {
  const { isFocusMode, toggleFocusMode } = useReaderPrefs();

  if (!isFocusMode) return null;

  return (
    <button
      type="button"
      onClick={toggleFocusMode}
      aria-label="Exit Focus Mode"
      title="Exit Focus Mode (show top and bottom bars)"
      tabIndex={0}
      className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-popover)] transition hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] sm:h-11 sm:w-11"
    >
      <X size={16} aria-hidden="true" />
      <span className="sr-only">Exit Focus Mode</span>
    </button>
  );
}
