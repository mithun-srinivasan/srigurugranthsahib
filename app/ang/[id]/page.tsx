/**
 * app/ang/[id]/page.tsx
 * ---------------------------------------------------------------------------
 * The main Ang reader page — the heart of the application.
 *
 * Rendered with ISR over a small pre-rendered hot set: `generateStaticParams`
 * covers only the Angs linked from high-traffic entry points (Japji Sahib
 * 1–8 on the home page, the Raag-section grid, featured sacred verses,
 * quick-jump markers, and Gurpurab calendar targets). Every other Ang
 * generates on first request (`dynamicParams`) and is then cached.
 * Pre-rendering all 1430 Angs ballooned every deployment past Vercel's 10 GB
 * Hobby Deployment Storage limit, while scripture never changes — so baking
 * rarely-visited Angs into each build bought nothing.
 *
 * `revalidate` (ISR, weekly) is load-bearing resilience, not freshness —
 * scripture never changes, but a single transient BaniDB failure once baked
 * a permanent 404 for `/ang/1430`. Weekly background regeneration means a
 * page stranded that way heals itself instead of waiting for a redeploy.
 *
 * Invalid numbers render `not-found.tsx`; a valid number whose scripture fails
 * to load renders `AngUnavailable` (retry card) instead of the 404.
 *
 * Layout:
 *   - `NavigationBar` (fixed top, scroll-aware auto-hide)
 *   - `SwipeContainer` (wraps content, adds horizontal-swipe navigation)
 *     - Ang start sentinel (scroll-to-top → previous Ang)
 *     - Header (source label, Raag name, "Ang N of 1430")
 *     - Verse list (one `VerseCard` per line)
 *     - Ang end sentinel (scroll-to-bottom → next Ang)
 *   - `BottomNav` (fixed bottom, scroll-aware auto-hide)
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAng, parseAngParam } from "@/lib/data";
import { MAX_ANG, MIN_ANG, type Ang } from "@/lib/types";
import NavigationBar from "@/components/NavigationBar";
import SwipeContainer from "@/components/SwipeContainer";
import DynamicAngHeader from "@/components/DynamicAngHeader";
import BottomNav from "./BottomNav";
import AngStartSentinel from "./AngStartSentinel";
import AngUnavailable from "./AngUnavailable";
import ClientAngReader from "./ClientAngReader";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Weekly background regeneration — self-heals pages stranded by a transient
 *  upstream failure (see header). Scripture is immutable, so a long window
 *  keeps CDN churn near zero; users always get instant cached pages and
 *  regeneration never blocks a visit. */
export const revalidate = 604800;

/** Unlisted Angs render on first request instead of 404ing — the ISR path
 *  that keeps 1379 rarely-visited Angs out of every deployment. */
export const dynamicParams = true;

/**
 * Pre-renders only the hot set: Japji Sahib (Angs 1–8) plus every Ang linked
 * from the home page (Raag-section grid, featured sacred verses, quick-jump
 * markers) and the Gurpurab calendar. Everything else builds on demand via
 * `dynamicParams` above.
 */
export function generateStaticParams() {
  // Every Ang linked from a high-traffic entry point (verified against live
  // BaniDB raag ranges + featured-verse locations — keep in sync with
  // RAAG_SECTIONS / SACRED_VERSES in app/page.tsx and GURPURABS).
  const HOT_ANGS = [
    1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 94, 139, 151, 217, 262, 347, 462,
    489, 527, 537, 595, 631, 660, 696, 711, 719, 721, 728, 773, 795,
    859, 885, 917, 975, 984, 989, 1107, 1118, 1125, 1144, 1168, 1197, 1254, 1294,
    1319, 1327, 1352, 1353, 1430,
  ];
  return HOT_ANGS.map((n) => ({ id: String(n) }));
}

/**
 * SEO metadata for each Ang page — includes the Ang number, optional Raag
 * name, and a snippet from the first translation (if available).
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const parsed = parseAngParam(id);
  // Never clamp here: an invalid id renders the 404, so its metadata must
  // not masquerade as a neighbouring valid Ang.
  if (parsed === null) {
    return { title: "Ang not found | Sri Guru Granth Sahib Ji" };
  }
  const angNumber = parsed;
  let ang: Ang | undefined;
  try {
    ang = await getAng(angNumber);
  } catch {
    // Failed to load scripture — return safe metadata so the page shell
    // still renders (the body will show the retry card via the page's own
    // try/catch). Never let metadata generation kill the whole page.
    return {
      title: `Ang ${angNumber} | Sri Guru Granth Sahib Ji`,
      description: `Read Ang ${angNumber} of Sri Guru Granth Sahib Ji.`,
    };
  }

  return {
    title: `Ang ${angNumber}${ang?.raagNameEn ? ` — ${ang.raagNameEn}` : ""} | Sri Guru Granth Sahib Ji`,
    description: ang?.lines?.[0]?.translations?.en ?? `Read Ang ${angNumber} of Sri Guru Granth Sahib Ji.`,
  };
}

export default async function AngPage({ params }: PageProps) {
  const { id } = await params;
  const parsed = parseAngParam(id);

  // Validate the Ang number; if invalid, render the custom not-found page.
  if (parsed === null) {
    notFound();
  }

  const angNumber = parsed;
  let ang: Ang;
  try {
    ang = await getAng(angNumber);
  } catch {
    // Network failure, offline, or API downtime — render retry card
    // (the error boundary will NOT cache this failure thanks to thrown error)
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors icon-border">
        <NavigationBar angNumber={angNumber} />
        <main className="mx-auto max-w-3xl px-5 pt-20 pb-28 sm:px-8 sm:pt-24">
          <AngUnavailable angNumber={angNumber} />
        </main>
        <BottomNav angNumber={angNumber} maxAng={MAX_ANG} minAng={MIN_ANG} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors icon-border">
      {/* Fixed top navigation bar */}
      <NavigationBar angNumber={angNumber} />

      {/* Swipeable content wrapper */}
      <SwipeContainer angNumber={angNumber}>
        <main className="mx-auto max-w-3xl px-5 pt-20 pb-28 sm:px-8 sm:pt-24 animate-in fade-in duration-300">
          {/* Scroll-to-top sentinel — detects "scroll back up" → previous Ang */}
          <AngStartSentinel angNumber={angNumber} minAng={MIN_ANG} />

          {/* Ang header: canonical section name, composition, and author */}
          <DynamicAngHeader currentAngId={angNumber} source={ang.source} />

          {/* Verse list — rendered and chained by the continuous-mode reader */}
          <ClientAngReader
            angNumber={angNumber}
            initialLines={ang.lines}
            maxAng={MAX_ANG}
          />
        </main>
      </SwipeContainer>

      {/* Fixed bottom navigation bar */}
      <BottomNav angNumber={angNumber} maxAng={MAX_ANG} minAng={MIN_ANG} />
    </div>
  );
}
