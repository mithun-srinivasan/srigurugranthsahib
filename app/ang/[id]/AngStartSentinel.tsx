/**
 * app/ang/[id]/AngStartSentinel.tsx
 * ---------------------------------------------------------------------------
 * An invisible, renderless component that detects when the user scrolls back
 * to the very top of the Ang page and navigates to the *previous* Ang.
 *
 * Behaviour:
 *   1. Watches for a downward scroll first (so opening the page at the top
 *      does not immediately navigate away).
 *   2. Once the user has scrolled down, a subsequent upward scroll that
 *      reaches within 8px of the top triggers the "crossfade-start" event
 *      and pushes `/ang/{N-1}`.
 *   3. Each scroll-back can only fire once per mount (guarded by `triggered` ref).
 *   4. No navigation happens if we are already at `minAng` (Ang 1).
 *
 * The "crossfade-start" CustomEvent is consumed by `PageTransition.tsx`,
 * which briefly fades the screen to simulate a gentle cross-fade.
 */

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReaderPrefs } from "@/components/ReaderPrefsProvider";

export default function AngStartSentinel({
  angNumber,
  minAng,
}: {
  angNumber: number;
  minAng: number;
}) {
  const router = useRouter();
  const { isAutoAdvance } = useReaderPrefs();

  /** Previous scroll Y — updated continuously during the scroll listener. */
  const previousScrollY = useRef(0);

  /** Set to `true` once the user scrolls down at least 5px from the top. */
  const hasScrolledDown = useRef(false);

  /** Prevents the navigation from firing more than once per mount. */
  const triggered = useRef(false);

  /** If we are already at the first Ang, nothing to navigate back to. */
  const isFirstAng = angNumber <= minAng;

  useEffect(() => {
    // Auto-back is opt-in via the isAutoAdvance pref.
    if (!isAutoAdvance || isFirstAng || triggered.current) return;

    // Initialise the baseline scroll position so the first frame is ignored.
    previousScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrolledDown = currentScrollY > previousScrollY.current + 5;
      const reachedTop = currentScrollY <= 8;
      const scrollingUp = currentScrollY < previousScrollY.current - 5;

      // Phase 1: detect that the user has scrolled down at least a little.
      if (scrolledDown) {
        hasScrolledDown.current = true;
      }

      // Phase 2: detect that the user has scrolled back up past the top
      // *after* having scrolled down previously.
      if (reachedTop && scrollingUp && hasScrolledDown.current && !triggered.current) {
        triggered.current = true;
        window.dispatchEvent(new CustomEvent("crossfade-start"));
        router.push(`/ang/${angNumber - 1}`);
      }

      previousScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isAutoAdvance, angNumber, isFirstAng, router]);

  // Nothing to render — all logic is side-effect driven.
  return null;
}