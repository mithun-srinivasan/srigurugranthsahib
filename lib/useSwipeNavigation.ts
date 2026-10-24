/**
 * lib/useSwipeNavigation.ts
 * ---------------------------------------------------------------------------
 * A client-side hook that attaches horizontal-swipe detection to any element.
 *
 * Used by `components/SwipeContainer.tsx` to give touch devices a native-feeling
 * "swipe left / right to change Ang" gesture without hijacking normal vertical
 * page scrolling.
 *
 * Tuning rationale (read before changing the constants):
 *   - The gesture must be *mostly horizontal*, otherwise we'd steal vertical
 *     scroll gestures from the user — hence deltaX > deltaY * 1.5.
 *   - It must travel far enough to feel deliberate (> 60px) and fast enough
 *     (< 600ms) so casual finger movement while reading never navigates.
 */

"use client";

import { useRef, type TouchEvent } from "react";

/** Callbacks returned to the consumer, spread onto the tracked element. */
interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
}

/**
 * Detects horizontal swipes and routes them to the provided callbacks.
 *
 * @param onSwipeLeft  invoked for a leftward swipe (finger moves leftward) → next Ang
 * @param onSwipeRight invoked for a rightward swipe (finger moves rightward) → previous Ang
 * @returns touch event handlers to spread onto the wrapping element
 */
export function useSwipeNavigation(
  onSwipeLeft: () => void,
  onSwipeRight: () => void
): SwipeHandlers {
  // Touch metrics are accumulated in refs (not state) to avoid re-rendering
  // the tree on every touchmove event during a gesture.
  const startX = useRef(0); // touchstart X position
  const startY = useRef(0); // touchstart Y position
  const startTime = useRef(0); // touchstart timestamp (ms)
  const deltaX = useRef(0); // cumulative horizontal travel
  const deltaY = useRef(0); // cumulative vertical travel

  /** Records the gesture's origin when a finger first touches the element. */
  const onTouchStart = (e: TouchEvent) => {
    // Ignore multi-touch gestures (pinch, two-finger scroll, etc.).
    if (e.touches.length > 1) return;
    // Never hijack touches on form elements — the user may be typing.
    const target = e.target;
    if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    startTime.current = Date.now();
    deltaX.current = 0;
    deltaY.current = 0;
  };

  /** Tracks the finger's cumulative travel while it is moving. */
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    deltaX.current = t.clientX - startX.current;
    deltaY.current = t.clientY - startY.current;
  };

  /** Decides, once the finger lifts, whether this movement qualifies as a swipe. */
  const onTouchEnd = () => {
    // Never navigate when text is selected (user may be selecting to copy/share).
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    const elapsed = Date.now() - startTime.current;
    const absX = Math.abs(deltaX.current);
    const absY = Math.abs(deltaY.current);

    // 1. More horizontal than vertical — protects vertical scroll gestures.
    const isHorizontal = absX > absY * 1.5;
    // 2. Travelled far enough to feel deliberate.
    const isFarEnough = absX > 60;
    // 3. Fast enough to feel like a swipe, not a drag.
    const isFastEnough = elapsed < 600;

    if (isHorizontal && isFarEnough && isFastEnough) {
      if (deltaX.current < 0) onSwipeLeft(); // finger moved left → go forward
      else onSwipeRight(); // finger moved right → go back
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}