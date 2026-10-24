/**
 * app/nitnem/[token]/page.tsx
 * ---------------------------------------------------------------------------
 * Nitnem bani reader (feature 27) — renders one daily prayer verse-by-verse
 * using the same `VerseCard` as the Ang reader (translations, commentary,
 * word meanings, highlights, notes, bookmarks all work).
 *
 * Statically generated for the five Nitnem tokens at build time via
 * `getBani()` (immutable BaniDB text, cached forever).  Bookmark / copy /
 * share attribution targets the bani page through VerseCard's bani props —
 * BaniDB's bani verse numbering (e.g. Jaap Sahib's `pageNo`) is unrelated to
 * Sri Guru Granth Sahib Ji Ang numbers and is never used as one.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { getBani } from "@/lib/data";
import { NITNEM_BANIS } from "@/lib/nitnem";
import { MAX_ANG, MIN_ANG, type Bani } from "@/lib/types";
import VerseCard from "@/components/VerseCard";
import FocusModeExit from "@/components/FocusModeExit";
import ReaderControls from "@/components/ReaderControls";

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Pre-render the five Nitnem banis at build time. */
export function generateStaticParams() {
  return NITNEM_BANIS.map((b) => ({ token: b.token }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const meta = NITNEM_BANIS.find((b) => b.token === token);
  if (!meta) return { title: "Nitnem | Sri Guru Granth Sahib Ji" };
  return {
    title: `${meta.name} | Daily Nitnem`,
    description: `${meta.name} (${meta.punjabiName}) — ${meta.description}`,
  };
}

/** Synchronous client component that holds the settings-popover state. */
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

export default async function BaniPage({ params }: PageProps) {
  const { token } = await params;
  const meta = NITNEM_BANIS.find((b) => b.token === token);
  if (!meta) notFound();

  const bani = await getBani(meta.id);
  if (!bani) notFound();

  return <BaniPageContent bani={bani} />;
}
