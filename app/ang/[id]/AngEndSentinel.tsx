/**
 * app/ang/[id]/AngEndSentinel.tsx
 * ---------------------------------------------------------------------------
 * Renders the "end of Ang" card at the bottom of every Ang reader page.
 *
 * Two behaviour modes:
 *
 *   1. **Continuous reading (feature 2)** — an `IntersectionObserver` watches
 *      the sentinel element; when the user scrolls it into the centre of the
 *      viewport (50% threshold), `onEndReached(angNumber)` is awaited:
 *        - if it returns `true`, the next Ang was *appended inline* by the
 *          parent reader, so this sentinel simply keeps watching; and
 *        - if it returns `false` (non-continuous, last Ang, or load failure),
 *          the component auto-navigates to the next Ang with a cross-fade.
 *   2. **Last Ang (1430)** — a quiet "Completed Sri Guru Granth Sahib Ji"
 *      message is displayed — no auto-advance or button.
 *
 * To keep the advance instant, the next Ang's route payload is prefetched as
 * soon as the sentinel mounts (see the prefetch effect) — the advance fires
 * `router.push` the moment the sentinel is half-visible, so a cold RSC cache
 * would stall the transition exactly when the reader's patience is thinnest.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { KhandaIcon } from "@/components/SikhSymbols";
import { useReaderPrefs } from "@/components/ReaderPrefsProvider";

export default function AngEndSentinel({
  angNumber,
  maxAng,
  onEndReached,
}: {
  angNumber: number;
  maxAng: number;
  onEndReached: (ang: number) => Promise<boolean>;
}) {
  const router = useRouter();
  const { isAutoAdvance, isContinuousMode } = useReaderPrefs();
  const nextAng = angNumber + 1;
  const isLastAng = angNumber >= maxAng;

  /** Whether navigation has already been triggered (stops duplicate pushes). */
  const [triggered, setTriggered] = useState(false);

  /** Whether a "load next Ang" request is in flight (for UI text). */
  const [loading, setLoading] = useState(false);

  /**
   * Ref guard so concurrent `IntersectionObserver` callbacks (and fast taps
   * on the manual button) cannot double-fire `onEndReached`.
   */
  const busyRef = useRef(false);

  /** Ref to the DOM element the IntersectionObserver watches. */
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  /**
   * The core advance routine: asks the parent whether the next Ang was
   * appended inline (continuous mode) or whether we should navigate instead.
   */
  const handleAdvance = useCallback(async () => {
    if (busyRef.current || triggered) return;
    busyRef.current = true;
    setLoading(true);

    // Never auto-advance past the last Ang, and never fire twice.
    let appended = false;
    if (!isLastAng) {
      appended = await onEndReached(angNumber);
    }

    if (appended) {
      // Parent appended the next Ang inline — keep watching for the next bottom.
      busyRef.current = false;
      setLoading(false);
      return;
    }

    // Fall back to full page navigation.
    setTriggered(true);
    setLoading(false);
    window.dispatchEvent(new CustomEvent("crossfade-start"));
    router.push(`/ang/${nextAng}`);
  }, [angNumber, nextAng, isLastAng, onEndReached, router, triggered]);

  // -- Advance-time prefetch ---------------------------------------------------
  // Warm the next Ang's route payload while the user is still reading.
  // BottomNav's `<Link prefetch>` cannot cover this: the bar is translated
  // off-screen during downward scroll, so its links never intersect the
  // viewport and Next.js never prefetches them — leaving this `router.push`
  // to pay the full fetch the instant the sentinel fires.

  useEffect(() => {
    if (!isLastAng) router.prefetch(`/ang/${nextAng}`);
  }, [isLastAng, nextAng, router]);

  // -- IntersectionObserver auto-advance -------------------------------------
  // Auto-advances when the user has opted in via isAutoAdvance OR isContinuousMode pref.
  // The manual Continue button always works regardless.

  const shouldAutoObserve = isAutoAdvance || isContinuousMode;

  useEffect(() => {
    if (!shouldAutoObserve || isLastAng || triggered) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !busyRef.current) {
          handleAdvance();
        }
      },
      { threshold: 0.5 } // trigger when the sentinel is 50% visible
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [shouldAutoObserve, isLastAng, triggered, handleAdvance]);

  // -- Final Ang: completion message -----------------------------------------

  if (isLastAng) {
    return (
      <div className="mt-16 text-center text-xs text-[var(--text-muted)] py-10 border-t border-[var(--border-subtle)]">
        <CheckCircle2 size={22} className="mx-auto mb-2 text-[var(--accent)]" />
        <p className="font-semibold text-[var(--text)]">Completed Sri Guru Granth Sahib Ji</p>
        <p className="mt-1 text-[var(--text-faint)]">Ang 1430 of 1430</p>
      </div>
    );
  }

  // -- Intermediate Angs: auto-advance card ----------------------------------

  return (
    <div
      ref={sentinelRef}
      className="mt-16 pt-8 border-t border-[var(--border-subtle)] transition-all duration-300"
    >
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center space-y-3 shadow-[var(--shadow-subtle)]">
        {/* Khanda emblem above the text */}
        <div className="flex justify-center text-[var(--accent)]">
          <KhandaIcon size={24} />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--text-faint)]">
            Completed Ang {angNumber}
          </p>
          <p className="text-xs font-semibold text-[var(--text)]">
            {loading
              ? `Loading Ang ${nextAng}…`
              : triggered
                ? `Transitioning to Ang ${nextAng}...`
                : `Advancing to Ang ${nextAng}`}
          </p>
        </div>

        {/* Manual continue button — fallback for users who prefer tapping */}
        <button
          onClick={handleAdvance}
          className="group inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.97]"
        >
          <span>Continue to Ang {nextAng}</span>
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}