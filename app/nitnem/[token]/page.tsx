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
 *
 * The page is a Server Component so `generateStaticParams` and
 * `generateMetadata` work; the settings-popover state lives in the
 * `"use client"` `BaniPageContent` component below.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { getBani } from "@/lib/data";
import { NITNEM_BANIS } from "@/lib/nitnem";
import { MAX_ANG, MIN_ANG, type Bani } from "@/lib/types";
import VerseCard from "@/components/VerseCard";
import FocusModeExit from "@/components/FocusModeExit";
import ReaderControls from "@/components/ReaderControls";
import BaniPageContent from "./BaniPageContent";

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

export default async function BaniPage({ params }: PageProps) {
  const { token } = await params;
  const meta = NITNEM_BANIS.find((b) => b.token === token);
  if (!meta) notFound();

  const bani = await getBani(meta.id);
  if (!bani) notFound();

  return <BaniPageContent bani={bani} />;
}
