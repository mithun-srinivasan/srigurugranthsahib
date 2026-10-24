/**
 * lib/ang.ts
 * ---------------------------------------------------------------------------
 * Canonical Ang range constants and Ang-number helpers.
 *
 * This module has NO server imports (no `next/navigation`, no `react`, no
 * `fetch`) so it is safe to import from any client component — NavigationBar,
 * SwipeContainer, and anywhere else that needs to clamp or parse Ang numbers
 * without pulling in the server-only data layer.
 *
 * Sri Guru Granth Sahib Ji spans Angs 1–1430 inclusive.
 */

/** Lower bound of valid Ang numbers (inclusive). */
export const MIN_ANG = 1;

/** Upper bound of valid Ang numbers (inclusive). */
export const MAX_ANG = 1430;

/**
 * Normalises any number into the valid Ang range [MIN_ANG, MAX_ANG].
 * Used by every navigation site (swipes, arrow keys, controls) so a user can
 * never navigate to a non-existent page.
 *
 * @param n any number (may be NaN)
 * @returns a clamped Ang number, defaulting to MIN_ANG for NaN
 */
export function clampAng(n: number): number {
  if (Number.isNaN(n)) return MIN_ANG;
  return Math.min(MAX_ANG, Math.max(MIN_ANG, n));
}

/** Parses an Ang route segment exactly; `1abc`, decimals, and signs are invalid. */
export function parseAngParam(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const ang = Number(value);
  return Number.isSafeInteger(ang) && ang >= MIN_ANG && ang <= MAX_ANG ? ang : null;
}
