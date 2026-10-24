/**
 * components/NitnemCard.tsx
 * ---------------------------------------------------------------------------
 * The Home-page "Daily Nitnem" card (feature 27).
 *
 * Static list of the daily prayers in traditional recitation order,
 * each linking to its bani reader page.  Server-rendered from the static
 * `NITNEM_BANIS` table — no fetch needed.
 */

import Link from "next/link";
import { ArrowRight, MoonStar } from "lucide-react";
import { NITNEM_BANIS } from "@/lib/nitnem";
import BorderBeam from "@/components/ui/BorderBeam";

export default function NitnemCard() {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
      {/* Magic UI ambient border beam */}
      <BorderBeam duration={18} delay={8} size={240} />

      <h2 className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-base font-bold text-[var(--text)]">
        <MoonStar size={18} className="text-[var(--accent)]" />
        <span>Daily Nitnem</span>
      </h2>

      <ul className="mt-4 space-y-3">
        {NITNEM_BANIS.map((bani) => (
          <li key={bani.token}>
            <Link
              href={`/nitnem/${bani.token}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-3 transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition">
                  {bani.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                  {bani.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-[var(--accent-light)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                  {bani.time}
                </span>
                <ArrowRight size={13} className="text-[var(--accent)]" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
