/**
 * components/SwipeContainer.tsx
 * ---------------------------------------------------------------------------
 * Wraps the main Ang content with a horizontal-swipe gesture detector.
 *
 * On touch devices, swiping left navigates to the next Ang and swiping right
 * navigates to the previous Ang (both clamped to the valid 1–1430 range).
 * Vertical scrolling is never affected — the hook filters for dominant
 * horizontal movement before triggering navigation.
 */

"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSwipeNavigation } from "@/lib/useSwipeNavigation";
import { clampAng } from "@/lib/ang";
import { MAX_ANG, MIN_ANG } from "@/lib/types";

export default function SwipeContainer({
  angNumber,
  children,
}: {
  angNumber: number;
  children: ReactNode;
}) {
  const router = useRouter();

  /**
   * Navigates to the given Ang number, clamped to the valid range.
   * This ensures we never route to an invalid URL.
   */
  const goTo = (n: number) => router.push(`/ang/${clampAng(n)}`);

  /**
   * Wire the swipe handlers:
   *   swipe left  (finger moves leftward)  → next Ang
   *   swipe right (finger moves rightward)  → previous Ang
   */
  const swipeHandlers = useSwipeNavigation(
    () => angNumber < MAX_ANG && goTo(angNumber + 1),
    () => angNumber > MIN_ANG && goTo(angNumber - 1)
  );

  return (
    <div {...swipeHandlers} className="touch-pan-y touch-pinch-zoom">
      {children}
    </div>
  );
}