/**
 * app/ang/[id]/ClientAngReader.tsx
 * ---------------------------------------------------------------------------
 * Client-side reader body that powers **Continuous Reading Mode** (feature 2).
 *
 * The server page renders the initial Ang's verses statically; this component
 * holds that list in state and — when the end sentinel says we hit the bottom
 * — appends the *next* Ang's verses inline (fetched via the `getAngForReader`
 * server action) instead of navigating to a new page.  The chain keeps growing
 * until the user reaches Ang 1430 or disables continuous mode.
 *
 * The next Ang's data is preloaded in the background while the user is still
 * reading (see the preload effect), so reaching the bottom appends instantly
 * instead of stalling on a live upstream round-trip exactly at the moment of
 * arrival.  Preloaded verses are immutable scripture, so reuse is always safe.
 *
 * It also reports completed Angs to `ProgressProvider.markAngRead` so the
 * reading-progress/streak/history features (7/8/9/13) see every Ang the user
 * reads to the end, in both single-page and continuous modes.
 *
 * Every rendered Ang is also fed to the offline search index
 * (`saveAngToOfflineIndex`) so `/search` keeps working offline against
 * visited Angs.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Ang, VerseLine } from "@/lib/types";
import VerseCard from "@/components/VerseCard";
import { useReaderPrefs } from "@/components/ReaderPrefsProvider";
import { useReadingProgress } from "@/components/ProgressProvider";
import { saveAngToOfflineIndex } from "@/lib/offline-search";
import AngEndSentinel from "./AngEndSentinel";
import { getAngForReader } from "./actions";

/** One Ang's worth of verses joined together in a reading chain. */
interface ChainAng {
  ang: number;
  lines: VerseLine[];
}

export default function ClientAngReader({
  angNumber,
  initialLines,
  maxAng,
}: {
  angNumber: number;
  initialLines: VerseLine[];
  maxAng: number;
}) {
  const prefs = useReaderPrefs();
  const { markAngRead } = useReadingProgress();

  /** Accumulated verse blocks; always starts with the statically-rendered Ang. */
  const [chain, setChain] = useState<ChainAng[]>([{ ang: angNumber, lines: initialLines }]);

  /**
   * In-flight or resolved preloads of upcoming Angs, keyed by Ang number.
   * Filled by the preload effect below while the user reads; consumed by
   * `handleEndReached` so arrival at the bottom never waits on the network.
   * Entries are deleted on consume; stale ones are harmless (scripture is
   * immutable) and the ref dies with the component on navigation.
   */
  const upcomingRef = useRef(new Map<number, Promise<Ang | null>>());

  // -- Background preload of the next Ang (continuous mode only) --------------
  // Fires on mount and every time the chain grows, so the Ang *after* the
  // current tail is always loading (or loaded) while the user reads.  Only
  // runs in continuous mode — otherwise the data would never be consumed.

  useEffect(() => {
    if (!prefs.isContinuousMode) return;
    const tail = chain[chain.length - 1].ang;
    const next = tail + 1;
    if (next > maxAng || upcomingRef.current.has(next)) return;
    // Attach a no-op catch so a preload nobody consumes never surfaces an
    // unhandled-rejection warning; consumers still await the original.
    const pending = getAngForReader(next);
    pending.catch(() => {});
    upcomingRef.current.set(next, pending);
  }, [chain, prefs.isContinuousMode, maxAng]);

  // -- Offline search index --------------------------------------------------
  // Every rendered Ang feeds the on-device search index so `/search` keeps
  // working offline against Angs the reader has actually visited. Indexing
  // is fire-and-forget localStorage writes — it must never block rendering.

  useEffect(() => {
    for (const segment of chain) {
      saveAngToOfflineIndex(segment.ang, segment.lines);
    }
  }, [chain]);

  /**
   * Handles "user has scrolled to the very bottom of Ang `ang`".
   *
   * Marks the Ang as read, then — if continuous mode is ON and there is a next
   * Ang — appends it, preferring the background preload (instant) and falling
   * back to a live fetch, returning `true` so the sentinel stays watching.
   * Returns `false` in all other cases, letting the sentinel fall back to
   * normal page navigation.
   */
  const handleEndReached = useCallback(
    async (ang: number): Promise<boolean> => {
      markAngRead(ang);

      if (!prefs.isContinuousMode || ang >= maxAng) return false;

      // Fast path: the preload effect already has this Ang (resolved or still
      // in flight — awaiting an in-flight preload still beats a fresh fetch).
      const preloaded = upcomingRef.current.get(ang + 1);
      if (preloaded) {
        upcomingRef.current.delete(ang + 1);
        try {
          const next = await preloaded;
          if (next) {
            setChain((c) => [...c, { ang: next.angNumber, lines: next.lines }]);
            return true;
          }
        } catch {
          // Preload failed — fall through to a fresh fetch below.
        }
      }

      try {
        const next = await getAngForReader(ang + 1);
        if (!next) return false; // load failed — fall back to navigating
        setChain((c) => [...c, { ang: next.angNumber, lines: next.lines }]);
        return true;
      } catch {
        return false; // unreachable API — navigate as usual
      }
    },
    [prefs.isContinuousMode, maxAng, markAngRead]
  );

  return (
    <>
      <section aria-label={`Ang ${angNumber} verses`}>
        {chain.map((segment) => (
          <div key={segment.ang}>
            {segment.lines.map((line) => (
              <VerseCard key={line.verseId} line={line} angNumber={segment.ang} />
            ))}
          </div>
        ))}
      </section>

      <AngEndSentinel
        angNumber={chain[chain.length - 1].ang}
        maxAng={maxAng}
        onEndReached={handleEndReached}
      />
    </>
  );
}
