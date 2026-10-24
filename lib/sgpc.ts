/**
 * lib/sgpc.ts
 * ---------------------------------------------------------------------------
 * Year-aware SGPC calendar loader with auto-update.
 *
 * How it works:
 *   - Bundled fallback (Samvat 558) lives in `lib/nanakshahi.ts` +
 *     `lib/gurpurabs.ts` so the app works offline on first paint.
 *   - Per-year releases live as plain JSON at `/data/sgpc-<year>.json`
 *     (see `public/data/sgpc-558.json`).  To publish a new year, just add
 *     `sgpc-559.json`, `sgpc-560.json`, … and redeploy — no code change.
 *   - At runtime the `useSgpcCalendar` hook resolves the Nanakshahi year for
 *     the viewed date, serves the bundled table instantly, then tries the
 *     year JSON (same-origin, or `NEXT_PUBLIC_SGPC_CALENDAR_BASE_URL` when
 *     set) and caches it in localStorage.  When a new year file appears,
 *     the app picks it up automatically.
 *
 * JSON shape:
 *   { nanakshahiYear, gregorianSpan, source, months[], gurpurabs[] }
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { GURPURABS } from "./gurpurabs";
import { NANAKSHAHI_MONTHS, type NanakshahiMonth } from "./nanakshahi";
import type { Gurpurab } from "./types";

/** Nanakshahi year bundled with the app (SGPC Samvat 558). */
export const SGPC_BUNDLED_YEAR = 558;

/** localStorage prefix for cached year calendars. */
const CACHE_PREFIX = "sggs-sgpc-";
const CACHE_META = "sggs-sgpc-meta";

export interface SgpcYearData {
  nanakshahiYear: number;
  gregorianSpan?: string;
  source?: string;
  months: NanakshahiMonth[];
  gurpurabs: Gurpurab[];
}

export type SgpcSource = "bundled" | "cache" | "updated";

/** Nanakshahi year for a Gregorian date (Chet Mar 14 cutoff). */
export function resolveNanakshahiYear(date: Date): number {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  return md >= 314 ? date.getFullYear() - 1468 : date.getFullYear() - 1469;
}

/** URL for a year's JSON release. */
export function sgpcDataUrl(year: number): string {
  const base = process.env.NEXT_PUBLIC_SGPC_CALENDAR_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/sgpc-${year}.json` : `/data/sgpc-${year}.json`;
}

function readCache(year: number): { data: SgpcYearData; updatedAt: number } | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${year}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.months) || !Array.isArray(parsed.gurpurabs)) {
      return null;
    }
    return {
      data: {
        nanakshahiYear: year,
        gregorianSpan: parsed.gregorianSpan,
        source: parsed.source ?? "cache",
        months: parsed.months,
        gurpurabs: parsed.gurpurabs,
      },
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeCache(year: number, data: SgpcYearData) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${year}`,
      JSON.stringify({ ...data, updatedAt: Date.now() })
    );
    localStorage.setItem(CACHE_META, JSON.stringify({ year, at: Date.now() }));
  } catch {
    // Private-browsing / quota — non-fatal.
  }
}

function isValidYearData(json: unknown, year: number): json is SgpcYearData {
  if (!json || typeof json !== "object") return false;
  const j = json as Record<string, unknown>;
  return (
    Array.isArray(j.months) &&
    (j.months as unknown[]).length === 12 &&
    Array.isArray(j.gurpurabs) &&
    (j.nanakshahiYear === undefined || j.nanakshahiYear === year)
  );
}

/** Fetches a year's release; returns null when missing/invalid/offline. */
export async function fetchSgpcYear(year: number): Promise<SgpcYearData | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(sgpcDataUrl(year), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || !text.trim()) return null;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return null;
    }
    if (!isValidYearData(json, year)) return null;
    const data: SgpcYearData = {
      nanakshahiYear: year,
      gregorianSpan: (json.gregorianSpan as string) ?? undefined,
      source: (json.source as string) ?? "sgpc",
      months: json.months,
      gurpurabs: json.gurpurabs,
    };
    writeCache(year, data);
    return data;
  } catch {
    return null;
  }
}

export interface ActiveSgpcCalendar {
  year: number;
  months: NanakshahiMonth[];
  gurpurabs: Gurpurab[];
  source: SgpcSource;
  updatedAt: number | null;
  gregorianSpan?: string;
  refresh: () => void;
  refreshTick: number;
}

/**
 * Resolves the SGPC calendar for `anchor` (defaults to today):
 * bundled data instantly, then cache, then network.  When SGPC publishes a
 * new `/data/sgpc-<year>.json`, this hook adopts it without a code change.
 */
export function useSgpcCalendar(anchor?: Date): ActiveSgpcCalendar {
  const year = resolveNanakshahiYear(anchor ?? new Date());
  const [months, setMonths] = useState<NanakshahiMonth[]>(NANAKSHAHI_MONTHS);
  const [gurpurabs, setGurpurabs] = useState<Gurpurab[]>(GURPURABS);
  const [source, setSource] = useState<SgpcSource>("bundled");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [gregorianSpan, setGregorianSpan] = useState<string | undefined>(undefined);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    // Bundled 558 is the fallback for every year until a release exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate progressive enhancement: paint bundled data, then upgrade to cache/network
    setMonths(NANAKSHAHI_MONTHS);
    setGurpurabs(GURPURABS);
    setSource("bundled");
    setUpdatedAt(null);
    setGregorianSpan(undefined);

    const cached = readCache(year);
    if (cached && !cancelled) {
      setMonths(cached.data.months);
      setGurpurabs(cached.data.gurpurabs);
      setGregorianSpan(cached.data.gregorianSpan);
      setSource("cache");
      setUpdatedAt(cached.updatedAt || null);
    }

    fetchSgpcYear(year).then((remote) => {
      if (cancelled || !remote) return;
      setMonths(remote.months);
      setGurpurabs(remote.gurpurabs);
      setGregorianSpan(remote.gregorianSpan);
      setSource("updated");
      setUpdatedAt(Date.now());
    });

    return () => {
      cancelled = true;
    };
  }, [year, refreshTick]);

  return { year, months, gurpurabs, source, updatedAt, gregorianSpan, refresh, refreshTick };
}
