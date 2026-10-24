/**
 * components/NavigationBar.tsx
 * ---------------------------------------------------------------------------
 * The fixed, scroll-aware top navigation bar shown on Ang reader pages.
 *
 * Features:
 *   - Home link, Previous / Next Ang buttons
 *   - Inline Ang number input (with clamping and form submission; the form
 *     carries `noValidate` so the browser's native min/max check can never
 *     swallow an out-of-range entry — every submit reaches `clampAng` and
 *     lands on a valid Ang instead of doing nothing)
 *   - Fullscreen toggle, Search link, Bookmarks link, Settings toggle
 *   - Scroll-aware auto-hide: hides as the user scrolls down to read,
 *     reappears immediately on upward scroll (or when controls are open)
 *   - Hover-aware edge-peek on every Ang: moving the mouse to the top edge
 *     (or hovering the bar itself) reveals it, moving away hides it again
 *     (focus mode uses hover-peek exclusively, without scroll-reveal)
 *   - Keyboard arrow-key navigation (Left → prev, Right → next)
 *   - Popover settings panel via `ReaderControls`
 *
 * When `angNumber` changes, the provider automatically saves the value to
 * localStorage so the home page can offer "Resume Ang N".
 */

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Settings2,
  Search,
  Bookmark,
  Home,
  Maximize2,
  Minimize2,
  Printer,
} from "lucide-react";
import { MAX_ANG, MIN_ANG } from "@/lib/types";
import { clampAng } from "@/lib/ang";
import { useReaderPrefs } from "./ReaderPrefsProvider";
import ReaderControls from "./ReaderControls";

/** How close (in px) the pointer must be to the top edge for the bar to peek in.
 *  Big enough that the whole bar + popover header area counts as "near top". */
const TOP_PEEK_ZONE = 96;

/** How long the bar lingers after the pointer leaves the top zone before hiding. */
const PEEK_HIDE_DELAY = 300;

export default function NavigationBar({ angNumber }: { angNumber: number }) {
  const router = useRouter();
  const { isFocusMode } = useReaderPrefs();

  /** The raw text inside the Ang number input field. */
  const [inputValue, setInputValue] = useState(String(angNumber));

  /** The Ang number the current `inputValue` was derived from.  Lets the input
   *  reset to match *navigation* while still letting the user type freely. */
  const [prevAngNumber, setPrevAngNumber] = useState(angNumber);
  if (prevAngNumber !== angNumber) {
    setPrevAngNumber(angNumber);
    setInputValue(String(angNumber));
  }

  /** Whether the ReaderControls popover is open. */
  const [controlsOpen, setControlsOpen] = useState(false);

  /** Visibility state for the scroll-aware auto-hide behaviour. */
  const [visible, setVisible] = useState(true);

  /** The previous scroll position — needed to determine scroll *direction*.
   *  A ref (not state) so the scroll listener never re-registers per frame. */
  const prevScrollY = useRef(0);

  /** Whether the document is currently in fullscreen mode. */
  const [isFullscreen, setIsFullscreen] = useState(false);

  /** Edge-peek: whether the bar is currently revealed because the pointer is
   *  near the top edge (or hovering the bar itself).  Works on every Ang —
   *  in focus mode it is the *only* way the bar reveals, outside focus mode
   *  it works *in addition to* the scroll-aware behaviour. */
  const [peeked, setPeeked] = useState(false);

  /** Delayed-hide timer so the bar doesn't flicker while crossing the top zone. */
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsOpenRef = useRef(controlsOpen);

  useEffect(() => {
    controlsOpenRef.current = controlsOpen;
  }, [controlsOpen]);

  /** Clears any pending peek-hide timer. */
  const cancelPeekHide = () => {
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  };

  /** Reveals the bar immediately (pointer entered top zone / bar). */
  const revealPeek = useCallback(() => {
    cancelPeekHide();
    setPeeked(true);
  }, []);

  /** Schedules the bar to hide (pointer left top zone / bar).  No-op while
   *  the settings popover is open so the panel stays interactive. */
  const schedulePeekHide = useCallback(() => {
    if (controlsOpenRef.current) return;
    if (peekTimer.current) return;
    peekTimer.current = setTimeout(() => {
      peekTimer.current = null;
      setPeeked(false);
    }, PEEK_HIDE_DELAY);
  }, []);

  // -- Edge-peek on mouse movement (every Ang, every mode) -------------------

  // Reset the peek slot when focus mode toggles (adjust state during render,
  // per the React docs — avoids a stale peek after toggling the mode off/on).
  const [prevFocusMode, setPrevFocusMode] = useState(isFocusMode);
  if (prevFocusMode !== isFocusMode) {
    setPrevFocusMode(isFocusMode);
    setPeeked(false);
  }

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Pointer inside the top zone (or over the bar itself) → reveal immediately.
      if (event.clientY <= TOP_PEEK_ZONE) {
        revealPeek();
        return;
      }
      // Pointer left the zone further than the bar itself → hide, unless the
      // Settings popover is open (the panel reaches below the top zone).
      schedulePeekHide();
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (peekTimer.current) clearTimeout(peekTimer.current);
    };
  }, [revealPeek, schedulePeekHide]);

  useEffect(() => {
    try {
      localStorage.setItem("sggs_last_ang", String(angNumber));
    } catch {
      // Private-browsing / quota-exceeded edge cases are ignored.
    }
  }, [angNumber]);

  // -- Fullscreen change listener --------------------------------------------

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  /** Toggles the browser's fullscreen API. */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // -- Scroll-aware auto hide / show -----------------------------------------

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always keep the bar visible when the settings panel is open.
      if (controlsOpen) {
        setVisible(true);
        return;
      }

      // Near the very top → always show.
      if (currentScrollY < 40) {
        setVisible(true);
      // Scrolled down more than 5px → hide for distraction-free reading.
      } else if (currentScrollY > prevScrollY.current + 5) {
        setVisible(false);
      // Scrolled up more than 5px → reveal immediately.
      } else if (currentScrollY < prevScrollY.current - 5) {
        setVisible(true);
      }

      prevScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [controlsOpen]);

  // -- Navigation helpers ---------------------------------------------------

  /** Pushes the router to the given (clamped) Ang page. */
  const goTo = useCallback((n: number) => {
    const clamped = clampAng(n);
    router.push(`/ang/${clamped}`);
  }, [router]);

  // -- Keyboard arrow-key navigation ----------------------------------------

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore events that have already been handled, or carry modifier keys.
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      // Never hijack keyboard input from form fields (the Ang number input).
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (isEditable) return;

      if (event.key === "ArrowLeft" && angNumber > MIN_ANG) {
        event.preventDefault();
        goTo(angNumber - 1);
      }

      if (event.key === "ArrowRight" && angNumber < MAX_ANG) {
        event.preventDefault();
        goTo(angNumber + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [angNumber, goTo]);

  // -- Ang number input submission -------------------------------------------

  const handleGoSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = parseInt(inputValue, 10);
    goTo(Number.isNaN(n) ? angNumber : n);
  };

  /** Whether the bar is currently shown: in focus mode only edge-peek (or
   *  settings popover) reveals it; otherwise scroll-aware visibility OR
   *  mouse hover near the top edge (peek) reveals it on every Ang. */
  const shown = isFocusMode ? peeked || controlsOpen : visible || peeked || controlsOpen;

  return (
    <header
      onMouseEnter={revealPeek}
      onMouseLeave={schedulePeekHide}
      className={`fixed top-0 inset-x-0 z-30 glass-nav-pinned transition-transform duration-300 ease-out ${
        shown ? "translate-y-0" : "-translate-y-full"
      } border-b border-[var(--border)]`}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
        {/* Left cluster: Home + Previous Ang */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
          >
            <Home size={18} />
          </Link>

          <button
            onClick={() => goTo(angNumber - 1)}
            disabled={angNumber <= MIN_ANG}
            aria-label="Previous Ang"
            title="Previous Ang"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-20 active:scale-[0.97]"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Center: inline Ang number input.
            `noValidate` is load-bearing: without it the browser blocks submit
            for out-of-range values (and the clamp below never runs), leaving
            the user staring at a dead input. With it, every Enter reaches
            `handleGoSubmit` → `clampAng` → a valid Ang page. `min`/`max` stay
            so mobile keyboards and the stepper keep the 1–1430 range. */}
        <form onSubmit={handleGoSubmit} noValidate className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--text-muted)]">Ang</span>
          <input
            type="number"
            min={MIN_ANG}
            max={MAX_ANG}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => setInputValue(String(angNumber))} // reset on blur to prevent drift
            inputMode="numeric"
            className="h-9 w-14 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-center text-xs font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
            aria-label="Go to Ang number"
          />
          <span className="text-xs text-[var(--text-faint)]">/ {MAX_ANG}</span>
        </form>

        {/* Right cluster: Fullscreen, Search, Bookmarks, Settings, Next Ang */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen Mode"}
            title={isFullscreen ? "Exit Full Screen" : "Full Screen Mode"}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <Link
            href="/search"
            aria-label="Search"
            title="Search Gurbani"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
          >
            <Search size={18} />
          </Link>

          <Link
            href="/bookmarks"
            aria-label="Bookmarks"
            title="Saved Bookmarks"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
          >
            <Bookmark size={18} />
          </Link>

          <Link
            href={`/ang/${angNumber}/print`}
            prefetch={false}
            aria-label="Print this Ang"
            title="Print / Save as PDF"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
          >
            <Printer size={18} />
          </Link>

          {/* Settings toggle — highlighted when the popover is open */}
          <button
            onClick={() => setControlsOpen((o) => !o)}
            aria-label="Reader Settings"
            aria-expanded={controlsOpen}
            title="Settings & Display"
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-[0.97] ${
              controlsOpen
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <Settings2 size={18} />
          </button>

          <button
            onClick={() => goTo(angNumber + 1)}
            disabled={angNumber >= MAX_ANG}
            aria-label="Next Ang"
            title="Next Ang"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-20 active:scale-[0.97]"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Popover settings panel — rendered immediately below the header when open */}
      {controlsOpen && (
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)] transition-all animate-in fade-in slide-in-from-top-2">
            <ReaderControls />
          </div>
        </div>
      )}
    </header>
  );
}