/**
 * components/GurpurabCalendar.tsx
 * ---------------------------------------------------------------------------
 * The Home-page "Upcoming Gurpurabs" card (feature 20).
 *
 * Year-aware: resolves the active SGPC calendar via `useSgpcCalendar`
 * (bundled 558 instantly, then `/data/sgpc-<year>.json` + cache).  When SGPC
 * publishes a new year file, the card adopts it with no code change.
 * Because the calculation depends on "today", it runs inside a `useEffect`
 * to avoid a server/client hydration mismatch.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ArrowRight, RefreshCw } from "lucide-react";
import { getUpcomingGurpurabs } from "@/lib/gurpurabs";
import { useSgpcCalendar } from "@/lib/sgpc";
import type { Gurpurab } from "@/lib/types";

interface Upcoming {
  gurpurab: Gurpurab;
  date: Date;
  days: number;
}

export default function GurpurabCalendar() {
  const { year, gurpurabs, source, refresh, isFallback } = useSgpcCalendar();
  const [upcoming, setUpcoming] = useState<Upcoming[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- compute next Gurpurabs after mount (matches date on client only)
    setUpcoming(getUpcomingGurpurabs(new Date(), 60, gurpurabs));
  }, [gurpurabs]);

  if (upcoming === null) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
        <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--surface-hover)]" />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
          <CalendarDays size={18} className="text-[var(--accent)]" />
          <span>Upcoming Gurpurabs</span>
          <span
            title={source === "bundled" ? "Bundled SGPC data (checking for update…)" : "SGPC data up to date"}
            className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]"
          >
            SGPC {year}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {source === "bundled" && (
            <button
              onClick={refresh}
              aria-label="Check for calendar update"
              title="Check for new SGPC year"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] transition hover:text-[var(--text)] hover:border-[var(--accent)]"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <Link
            href="/calendar"
            aria-label="Full calendar"
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          >
            <CalendarDays size={15} />
            <span>Full calendar</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

        {isFallback && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Dates for Nanakshahi year {year} are not yet published by SGPC —
            showing bundled Samvat 558 data. Gurpurab dates may be inaccurate
            for this year.{" "}
            <button
              onClick={refresh}
              className="ml-2 underline underline-offset-4 hover:text-[var(--accent)] text-xs"
              aria-label="Check for new SGPC calendar release"
            >
              Check for update
            </button>
          </p>
        )}

        {upcoming.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          No major Gurpurabs in the next 60 days.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {upcoming.map(({ gurpurab, date, days }) => (
            <li key={gurpurab.name}>
              <Link
                href={`/ang/${gurpurab.ang}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-3 transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition">
                    {gurpurab.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                    {gurpurab.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-[var(--text)]">
                      {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                    <p className="text-[10px] text-[var(--text-faint)]">
                      {days === 0 ? "today" : `in ${days}d`}
                    </p>
                    {/* Target Ang chip — makes the link destination explicit. */}
                    <p className="mt-1 inline-block rounded-md bg-[var(--accent-light)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                      Ang {gurpurab.ang}
                    </p>
                  </div>
                  <ArrowRight size={13} className="text-[var(--accent)]" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}