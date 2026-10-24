/**
 * components/ShabadOfDayCard.tsx
 * ---------------------------------------------------------------------------
 * The Home-page "Shabad of the Day" card (feature 30).
 *
 * Calls the `getDailyShabad` server action (a random full shabad from
 * BaniDB), then caches the result in localStorage under the local date key
 * so the same shabad shows all day — and repeat visits stay instant (and
 * work offline once cached).  Renders a quiet skeleton while loading and a
 * fallback state when the fetch fails.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { DailyShabad } from "@/lib/types";
import BorderBeam from "@/components/ui/BorderBeam";
import { dayKey } from "./ProgressProvider";

/** localStorage key for the date-keyed daily shabad cache. */
const STORAGE_KEY = "sgs-reader-shabad-day";

interface CachedShabad {
  date: string;
  shabad: DailyShabad;
}

/** Reads today's cached shabad, or null when absent/stale/corrupt. */
function readCached(today: string): DailyShabad | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedShabad;
    if (parsed.date !== today || !parsed.shabad || !Array.isArray(parsed.shabad.verses)) {
      return null;
    }
    return parsed.shabad;
  } catch {
    return null;
  }
}

export default function ShabadOfDayCard({
  shabad: serverShabad,
}: {
  /** Data fetched by the server component (ShabadOfDayServer). When provided,
   *  the card skips its own client-side fetch and renders immediately. */
  shabad?: DailyShabad | null;
}) {
  const [shabad, setShabad] = useState<DailyShabad | null>(serverShabad ?? null);
  const [loading, setLoading] = useState(!serverShabad);

  useEffect(() => {
    // Server-provided data needs no client fetch — just seed the cache and render.
    if (serverShabad) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- server-provided data needs no client fetch
      setLoading(false);
      return;
    }

    let cancelled = false;
    const today = dayKey();
    const cached = readCached(today);
    if (cached) {
      setShabad(cached);
      setLoading(false);
      return;
    }
    // Bounded fetch (same 12 s mobile-data budget as the Hukamnama card):
    // a slow network drops to the fallback instead of holding the skeleton.
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("shabad timeout")), 12000)
    );
    const fetchShabad = fetch("/shabad-of-day").then((res) => {
      if (!res.ok) throw new Error(`Shabad HTTP ${res.status}`);
      return res.json() as Promise<DailyShabad>;
    });
    Promise.race([fetchShabad, timeout])
      .then((s) => {
        if (cancelled) return;
        if (s) {
          setShabad(s);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, shabad: s }));
          } catch {
            // quota / private mode — the shabad still displays this session
          }
        }
      })
      .catch(() => {
        if (!cancelled) setShabad(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverShabad]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          <Sparkles size={14} />
          <span>Shabad of the Day</span>
        </div>
        <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[var(--surface-hover)]" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[var(--surface-hover)]" />
      </section>
    );
  }

  if (!shabad || shabad.verses.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          <Sparkles size={14} />
          <span>Shabad of the Day</span>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Today&apos;s shabad could not be loaded right now. Please check back later.
        </p>
      </section>
    );
  }

  const firstId = shabad.verses[0]?.verseId;

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
      {/* Magic UI ambient border beam */}
      <BorderBeam duration={16} delay={4} size={220} />

      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
        <Sparkles size={14} />
        <span>Shabad of the Day</span>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[11px] font-semibold text-[var(--text-faint)]">
          {shabad.raag ?? ""}
          {shabad.raag && shabad.writer ? " · " : ""}
          {shabad.writer ?? ""}
        </p>
        <p dir="auto" lang="pa" className="font-gurmukhi break-words text-lg leading-loose text-[var(--text)]">
          {shabad.verses
            .slice(0, 3)
            .map((l) => l.gurmukhi)
            .join(" ")}
        </p>
        {shabad.verses[0]?.translations.en && (
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {shabad.verses[0].translations.en}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end border-t border-[var(--border-subtle)] pt-3">
        <Link
          href={firstId ? `/ang/${shabad.ang}#${firstId}` : `/ang/${shabad.ang}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          <span>
            Read full shabad (Ang {shabad.ang}
            {shabad.verses.length > 1 ? ` · ${shabad.verses.length} verses` : ""})
          </span>
          <ArrowRight size={12} />
        </Link>
      </div>
    </section>
  );
}
