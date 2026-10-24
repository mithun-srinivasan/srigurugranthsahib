/**
 * app/ang/[id]/print/page.tsx
 * ---------------------------------------------------------------------------
 * A print-optimised view of a whole Ang (feature 15: Print / PDF).
 *
 * Rendered on-demand with ISR (`revalidate`, weekly) instead of full SSG:
 * pre-rendering all 1430 print pages doubled deployment output (~370 MB per
 * deployment) and blew past Vercel's 10 GB Hobby Deployment Storage limit,
 * while these pages are `noindex`, secondary traffic, and identical in data
 * to the hot-set reader page. Each print layout mirrors the reader's
 * verse order:
 *   Gurmukhi          (always, large & solid — the scripture itself)
 *   Transliteration   (Latin script)
 *   English translation
 *   Punjabi translation
 * separated by a quiet divider between verses.
 *
 * The browser's native print dialog (→ Save as PDF) is triggered from the
 * header; the `print:` CSS in `globals.css` strips all chrome and the screen
 * header for a clean printed page.
 *
 * `revalidate` (ISR, weekly) mirrors the reader page: a transient BaniDB
 * failure strands a page for at most a week, never until the next redeploy.
 * Scripture is immutable, so a long window keeps CDN churn near zero.
 * First visit renders live from BaniDB, then serves cached.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAng, parseAngParam } from "@/lib/data";
import { MIN_ANG, MAX_ANG, type Ang } from "@/lib/types";
import PrintAng from "./PrintAng";
import AngUnavailable from "../AngUnavailable";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Weekly background regeneration — self-heals pages stranded by a transient
 *  upstream failure (see header). First visit renders on demand, then caches. */
export const revalidate = 604800;

/** Allow any Ang id to render on demand — print pages are ISR, not pre-rendered. */
export const dynamicParams = true;

/**
 * Pre-renders zero print pages: they are `noindex`, rarely visited, and
 * share the reader's data, so baking any of them into the deployment is
 * pure storage cost. Every id builds on demand via `dynamicParams` above.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const parsed = parseAngParam(id);
  // Never clamp here: an invalid id renders the 404, so its metadata must
  // not masquerade as a neighbouring valid Ang.
  if (parsed === null) {
    return {
      title: "Ang not found | Sri Guru Granth Sahib Ji",
      description: `That Ang number is out of range. Sri Guru Granth Sahib Ji spans Ang ${MIN_ANG} to ${MAX_ANG}.`,
      robots: { index: false },
    };
  }
  const angNumber = parsed;
  let ang: Ang;
  try {
    ang = await getAng(angNumber);
  } catch {
    // Return metadata for failed load — the page will show retry card
    return {
      title: `Print Ang ${angNumber} | Sri Guru Granth Sahib Ji`,
      description: `Print-ready view of Ang ${angNumber} of Sri Guru Granth Sahib Ji.`,
      robots: { index: false },
    };
  }
  return {
    title: `Print Ang ${angNumber}${ang.raagNameEn ? ` — ${ang.raagNameEn}` : ""} | Sri Guru Granth Sahib Ji`,
    description: `Print-ready view of Ang ${angNumber} of Sri Guru Granth Sahib Ji.`,
    robots: { index: false },
  };
}

export default async function PrintAngPage({ params }: PageProps) {
  const { id } = await params;
  const parsed = parseAngParam(id);
  if (parsed === null) notFound();

  const angNumber = parsed;
  let ang: Ang;
  try {
    ang = await getAng(angNumber);
  } catch {
    // Valid number but the scripture failed to load (offline / API down) —
    // show the retry card, not the "out of range" 404.
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <main className="mx-auto max-w-3xl px-6 py-8 sm:py-10">
          <AngUnavailable angNumber={angNumber} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <PrintAng angNumber={angNumber} lines={ang.lines} />

      <main className="mx-auto max-w-3xl px-6 py-8 sm:py-10">
        <div className="text-center border-b border-[var(--border)] pb-6">
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {ang.source ?? "Sri Guru Granth Sahib Ji"}
          </p>
          <h1 className="mt-1 text-xl font-bold">{ang.raagName ?? ang.raagNameEn ?? `Ang ${angNumber}`}</h1>
          {ang.raagName && ang.raagNameEn && ang.raagNameEn !== ang.raagName && (
            <p className="text-sm text-[var(--text-muted)]">{ang.raagNameEn}</p>
          )}
          <p className="text-sm text-[var(--text-muted)]">Ang {angNumber} of {MAX_ANG}</p>
        </div>

        <article className="mt-8 space-y-7">
          {ang.lines.map((line) => (
            <section key={line.verseId} className="break-inside-avoid border-b border-[var(--border-subtle)] pb-6">
              <p dir="auto" lang="pa" className="font-gurmukhi text-xl leading-[1.9] text-[var(--text)]">
                {line.gurmukhi}
              </p>
              {line.transliteration && (
                <p className="mt-2 text-xs italic text-[var(--text-muted)]">
                  {line.transliteration}
                </p>
              )}
              {line.translations.en && (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{line.translations.en}</p>
              )}
              {line.translations.pu && (
                <p dir="auto" lang="pa" className="font-gurmukhi mt-1 text-sm text-[var(--text-secondary)]">
                  {line.translations.pu}
                </p>
              )}
              {line.translations.hi && (
                <p dir="auto" lang="hi" className="mt-1 text-sm text-[var(--text-secondary)]">
                  {line.translations.hi}
                </p>
              )}
              {line.translations.es && (
                <p dir="auto" lang="es" className="mt-1 text-sm text-[var(--text-secondary)]">
                  {line.translations.es}
                </p>
              )}
            </section>
          ))}
        </article>

        <footer className="mt-12 border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--text-muted)]">
          Sri Guru Granth Sahib Ji — {angNumber} of {MAX_ANG}
        </footer>
      </main>
    </div>
  );
}
