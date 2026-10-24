/**
 * app/nitnem/[token]/BaniPageContent.tsx
 * ---------------------------------------------------------------------------
 * Client component holding the Nitnem settings-popover state. Extracted from
 * BaniPage so the page stays a Server Component (generateStaticParams /
 * generateMetadata) while the popover toggle can use useState.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import type { Bani } from "@/lib/types";
import { MAX_ANG, MIN_ANG } from "@/lib/types";
import VerseCard from "@/components/VerseCard";
import FocusModeExit from "@/components/FocusModeExit";
import ReaderControls from "@/components/ReaderControls";

function BaniPageContent({ bani }: { bani: Bani }) {
  /** Whether the ReaderControls settings popover is open. */
  const [controlsOpen, setControlsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b bg-[var(--bg)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/nitnem"
            aria-label="Back to Nitnem list"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-[var(--text)]">{bani.name}</h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              {bani.verses.length} verses · {bani.time}
            </p>
          </div>
          <button
            onClick={() => setControlsOpen((o) => !o)}
            aria-label="Reader Settings"
            aria-expanded={controlsOpen}
            title="Settings & Display"
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-[0.97] ${
              controlsOpen
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <Settings2 size={18} />
          </button>
        </div>

        {/* Popover settings panel — rendered immediately below the header when open */}
        {controlsOpen && (
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)] transition-all animate-in fade-in slide-in-from-top-2">
              <ReaderControls />
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-28 pt-6 sm:px-8">
        <header className="mb-8 border-b border-[var(--border-subtle)] pb-6 text-center">
          <p dir="auto" lang="pa" className="font-gurmukhi text-xl text-[var(--text-muted)]">
            {bani.punjabiName}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{bani.description}</p>
        </header>

        {bani.verses.map((line) => (
          <VerseCard
            key={line.verseId}
            line={line}
            angNumber={
              line.pageNo && line.pageNo >= MIN_ANG && line.pageNo <= MAX_ANG ? line.pageNo : MIN_ANG
            }
            baniToken={bani.token}
            baniName={bani.name}
          />
        ))}
      </main>

      {/* Focus Mode exit — always visible when focus mode is on */}
      <FocusModeExit />
    </div>
  );
}

export default BaniPageContent;
