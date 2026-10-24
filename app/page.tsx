/**
 * app/page.tsx
 * ---------------------------------------------------------------------------
 * The home / landing page of Sri Guru Granth Sahib Ji Reader.
 *
 * Sections rendered (top to bottom):
 *   1. Pinned glass header — logo, fullscreen toggle, search, bookmarks, theme
 *   2. Hero — Mool Mantar, app title, Resume / Random Ang buttons
 *   3. Quick Ang navigation — slider (1–1430), quick-jump markers, number input
 *   4. Sacred Wisdom — a rotating selection of famous verses with "Read in Context" links
 *   5. 31 Raags & Major Sections — a grid of link cards to every Raag's starting Ang
 *   6. Footer
 *
 * Data read on mount:
 *   - `sggs_last_ang` from localStorage → "Resume Ang N" button text
 *   - `fullscreenchange` event → toggle the fullscreen icon
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useReaderPrefs } from "@/components/ReaderPrefsProvider";
import HukamnamaCard from "@/components/HukamnamaCard";
import ReadingHeatmap from "@/components/ReadingHeatmap";
import ShabadOfDayCard from "@/components/ShabadOfDayCard";
import NitnemCard from "@/components/NitnemCard";
import ReadingJourney from "@/components/ReadingJourney";
import GurpurabCalendar from "@/components/GurpurabCalendar";
import Particles from "@/components/ui/Particles";
import ShinyText from "@/components/ui/ShinyText";
import { KhandaIcon } from "@/components/SikhSymbols";
import {
  BookOpen,
  Search,
  Bookmark,
  Shuffle,
  Compass,
  ArrowRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Sun,
  Moon,
  Coffee,
  GraduationCap,
  Github,
} from "lucide-react";
import { MAX_ANG, MIN_ANG } from "@/lib/types";
import { SACRED_VERSES, RAAG_SECTIONS, getRaagForAng, TOTAL_CANONICAL_SECTIONS } from "@/lib/homeConstants";

// -------------------------------------------------------------------------
// Home page component
// -------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();
  const prefs = useReaderPrefs();

  // -- Local state ----------------------------------------------------------

  /** The target Ang selected via the slider / number input (before navigation). */
  const [targetAng, setTargetAng] = useState<number>(1);

  /** The last Ang the user read, read from localStorage. `null` until hydrated. */
  const [lastReadAng, setLastReadAng] = useState<number | null>(null);

  /** Whether the browser is currently in fullscreen mode. */
  const [isFullscreen, setIsFullscreen] = useState(false);

  /** Index of the currently displayed sacred verse (0–SACRED_VERSES.length-1). */
  const [verseIndex, setVerseIndex] = useState<number>(0);

  /** Brief opacity animation while rotating between sacred verses. */
  const [isRotating, setIsRotating] = useState(false);

  /** Rotation timer handle — cancelled on unmount to avoid stale setState. */
  const rotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rotateTimer.current) clearTimeout(rotateTimer.current);
    },
    []
  );

  // -- Effects --------------------------------------------------------------

  /** Hydrate `lastReadAng` from localStorage once on mount. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sggs_last_ang");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_ANG && parsed <= MAX_ANG) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-mount hydration from localStorage (SSR-safe)
          setLastReadAng(parsed);
        }
      }
    } catch {
      // localStorage unavailable or corrupt — safe to ignore.
    }
  }, []);

  /** Listen for the fullscreen API change to update the header icon. */
  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  /** Toggles the browser fullscreen API. */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  /** Navigates to a random Ang between MIN_ANG and MAX_ANG (inclusive). */
  const handleRandomAng = () => {
    const random = Math.floor(Math.random() * (MAX_ANG - MIN_ANG + 1)) + MIN_ANG;
    router.push(`/ang/${random}`);
  };

  /**
   * Rotates to the next sacred verse with a brief fade-out/fade-in
   * animation driven by the `isRotating` state and a 150ms timeout.
   */
  const nextSacredVerse = () => {
    setIsRotating(true);
    if (rotateTimer.current) clearTimeout(rotateTimer.current);
    rotateTimer.current = setTimeout(() => {
      setVerseIndex((prev) => (prev + 1) % SACRED_VERSES.length);
      setIsRotating(false);
    }, 150);
  };

  // -- Derived values -------------------------------------------------------

  const currentVerse = SACRED_VERSES[verseIndex];

  /** The next theme in the cycle: light → dark → sepia → light. */
  const nextTheme = prefs.theme === "light" ? "dark" : prefs.theme === "dark" ? "sepia" : "light";

  /** Icon component matching the current theme. */
  const ThemeIcon = prefs.theme === "light" ? Sun : prefs.theme === "dark" ? Moon : Coffee;

  return (
    <div className="relative min-h-screen text-[var(--text)] transition-colors overflow-hidden icon-border">
      {/* ------------------------------------------------------------------ */}
      {/* Background Image — Sri Harmandir Sahib (Golden Temple) at night     */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/golden-temple-night.png"
          alt="Sri Harmandir Sahib (Golden Temple) at night"
          fill
          priority
          fetchPriority="high"
          quality={75}
          sizes="100vw"
          className="object-cover object-center pointer-events-none"
        />
        {/* Semi-transparent theme-coloured overlay with soft blur */}
        <div className="absolute inset-0 bg-[var(--bg)]/80 backdrop-blur-[2px] transition-colors" />
        {/* Ambient celestial particles drifting over the night sky */}
        <Particles quantity={35} color="var(--accent)" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Foreground Content                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative z-10 min-h-screen">

        {/* -------------------------------------------------------------- */}
        {/* Pinned Glass Header                                              */}
        {/* -------------------------------------------------------------- */}
        <header className="sticky top-0 z-30 glass-nav-pinned">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
            {/* Logo / Title */}
            <Link href="/" className="flex items-center gap-2">
              <span className="font-gurmukhi text-lg font-bold text-[var(--accent)]">ੴ</span>
              <h2 className="text-sm font-bold tracking-tight text-[var(--text)]">
                Sri Guru Granth Sahib Ji
              </h2>
            </Link>

            <nav className="flex items-center gap-1">
              {/* Fullscreen toggle */}
              <button
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>

              {/* Search */}
              <Link
                href="/search"
                aria-label="Search Gurbani"
                title="Search Gurbani"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
              >
                <Search size={18} />
              </Link>

              {/* Bookmarks */}
              <Link
                href="/bookmarks"
                aria-label="Saved Bookmarks"
                title="Saved Bookmarks"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
              >
                <Bookmark size={18} />
              </Link>

              {/* Learn Gurmukhi */}
              <Link
                href="/learn"
                aria-label="Learn Gurmukhi"
                title="Learn Gurmukhi"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
              >
                <GraduationCap size={18} />
              </Link>

              {/* GitHub source */}
              <a
                href="https://github.com/mithun-srinivasan/srigurugranthsahib"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                title="View source on GitHub"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
              >
                <Github size={18} />
              </a>

              {/* Theme cycle: light → dark → sepia → light */}
              <button
                onClick={() => prefs.setTheme(nextTheme)}
                aria-label={`Switch to ${nextTheme} theme`}
                title={`Switch to ${nextTheme} theme`}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text)] hover:bg-[var(--surface-hover)] bg-[var(--surface)]/80"
              >
                <ThemeIcon size={18} />
              </button>

              {/* Quick-read button (desktop only) — always links to last-read or Ang 1 */}
              <Link
                href={`/ang/${lastReadAng || 1}`}
                className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                <BookOpen size={15} />
                <span>Read Ang</span>
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16 space-y-16 animate-in fade-in duration-300">

          {/* -------------------------------------------------------------- */}
          {/* Hero Section                                                     */}
          {/* -------------------------------------------------------------- */}
          <section className="text-center space-y-6">
            <ShinyText>
              <p className="font-gurmukhi text-3xl sm:text-4xl font-semibold tracking-wide text-[var(--accent)]">
                ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ
              </p>
            </ShinyText>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)] sm:text-5xl">
                Sri Guru Granth Sahib Ji
              </h1>
              <p className="mx-auto max-w-lg text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                A distraction-free, quiet digital sanctuary for contemplating sacred Gurbani verse-by-verse across all 1430 Angs.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {/* Resume (or start from Ang 1) with subtle shimmer sheen */}
              <Link
                href={`/ang/${lastReadAng || 1}`}
                className="group relative isolate flex min-h-[44px] items-center gap-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--accent)] px-6 py-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.97]"
              >
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit] motion-reduce:hidden">
                  <div className="absolute inset-[-100%] aspect-square [animation:shimmer-spin_3.5s_linear_infinite] [background:conic-gradient(from_0deg_at_50%_50%,transparent_0%,rgba(255,255,255,0.3)_15%,transparent_30%)]" />
                </div>
                <BookOpen size={16} />
                <span>{lastReadAng ? `Resume Ang ${lastReadAng}` : "Begin Reading (Ang 1)"}</span>
              </Link>

              {/* Random Ang */}
              <button
                onClick={handleRandomAng}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md px-5 py-3 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--surface-hover)] active:scale-[0.97]"
              >
                <Shuffle size={16} className="text-[var(--accent)]" />
                <span>Random Ang</span>
              </button>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Daily Hukamnama — sourced from the official SGPC website        */}
          {/* -------------------------------------------------------------- */}
          <HukamnamaCard />

          {/* -------------------------------------------------------------- */}
          {/* Shabad of the Day — deterministic by date, same for everyone     */}
          {/* -------------------------------------------------------------- */}
          <ShabadOfDayCard />

          {/* -------------------------------------------------------------- */}
          {/* Daily Nitnem — the five daily prayers                           */}
          {/* -------------------------------------------------------------- */}
          <NitnemCard />

          {/* -------------------------------------------------------------- */}
          {/* Reading journey — progress, streak, history, Sehaj Paath plan   */}
          {/* -------------------------------------------------------------- */}
          <ReadingJourney />

          {/* -------------------------------------------------------------- */}
          {/* Reading heatmap — 20-week activity grid from visit history      */}
          {/* -------------------------------------------------------------- */}
          <ReadingHeatmap />

          {/* -------------------------------------------------------------- */}
          {/* Quick Ang Navigation — slider + quick-jump markers + number input */}
          {/* -------------------------------------------------------------- */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 space-y-6 shadow-[var(--shadow-subtle)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
                  <Compass size={18} className="text-[var(--accent)]" />
                  <span>Go to Ang (1–1430)</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Drag the smooth slider or use quick jump markers.
                </p>
              </div>
              <div className="text-right text-xs">
                <span className="font-semibold text-[var(--text-muted)]">Selected: </span>
                <span className="font-bold text-[var(--accent)] text-sm">Ang {targetAng}</span>
                <span className="font-gurmukhi block text-[var(--text-faint)] mt-0.5">{getRaagForAng(targetAng)}</span>
              </div>
            </div>

            {/* Custom slider: a hidden `<input type="range">` with a painted
                progress bar and floating thumb rendered via absolute positioning. */}
            <div className="space-y-4">
              <div className="relative flex items-center py-2">
                {/* Background track */}
                <div className="absolute h-2.5 w-full rounded-full bg-[var(--border)]" />
                {/* Visual landmark detent notches (inspired by interior.dev slider detents) */}
                <div className="pointer-events-none absolute inset-x-0 h-2.5 flex items-center">
                  {[1, 14, 262, 462, 917, 1430].map((angNum) => {
                    const pct = ((angNum - 1) / (MAX_ANG - 1)) * 100;
                    return (
                      <span
                        key={angNum}
                        aria-hidden="true"
                        className="absolute block h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-[var(--text-faint)] opacity-40"
                        style={{ left: `${pct}%` }}
                      />
                    );
                  })}
                </div>
                {/* Filled progress bar */}
                <div
                  role="progressbar"
                  aria-valuenow={targetAng}
                  aria-valuemin={MIN_ANG}
                  aria-valuemax={MAX_ANG}
                  aria-label="Ang number selection progress"
                  className="absolute h-2.5 rounded-full bg-[var(--accent)] transition-all duration-75"
                  style={{ width: `${((targetAng - 1) / (MAX_ANG - 1)) * 100}%` }}
                />
                {/* Actual range input (opacity-0, overlays the painted elements) */}
                <input
                  type="range"
                  min={MIN_ANG}
                  max={MAX_ANG}
                  value={targetAng}
                  onChange={(e) => setTargetAng(parseInt(e.target.value, 10))}
                  className="relative z-10 h-2.5 w-full cursor-pointer opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  aria-label="Ang number selection slider"
                />
                {/* Custom thumb indicator */}
                <div
                  className="absolute z-20 h-5 w-5 rounded-full bg-[var(--accent)] shadow-md border-2 border-[var(--surface)] pointer-events-none transition-transform active:scale-125"
                  style={{ left: `calc(${((targetAng - 1) / (MAX_ANG - 1)) * 100}% - 10px)` }}
                />
              </div>

              {/* Quick-jump landmark buttons */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
                <span className="text-[var(--text-faint)]">Quick Jumps:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 14, 262, 462, 917, 1430].map((angNum) => (
                    <button
                      key={angNum}
                      onClick={() => setTargetAng(angNum)}
                      className={`rounded-md px-2 py-0.5 font-semibold transition-all duration-150 active:scale-[0.93] ${
                        targetAng === angNum
                          ? "bg-[var(--accent)] text-white shadow-sm"
                          : "bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      Ang {angNum}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number input + Go button */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">Ang:</span>
                  <input
                    type="number"
                    min={MIN_ANG}
                    max={MAX_ANG}
                    value={targetAng}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) setTargetAng(Math.min(MAX_ANG, Math.max(MIN_ANG, val)));
                    }}
                    inputMode="numeric"
                    className="h-10 w-20 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-center text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <Link
                  href={`/ang/${targetAng}`}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97]"
                >
                  <span>Open Ang {targetAng}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Sacred Wisdom — rotating featured verse display                    */}
          {/* -------------------------------------------------------------- */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 text-center space-y-5 shadow-[var(--shadow-subtle)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                <Sparkles size={14} />
                <span>{currentVerse.title}</span>
              </div>

              {/* "Next Verse" button with brief spinning animation */}
              <button
                onClick={nextSacredVerse}
                aria-label="Refresh contemplation verse"
                title="Explore another sacred verse"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition active:scale-[0.97]"
              >
                <RefreshCw size={13} className={isRotating ? "animate-spin" : ""} />
                <span>Next Verse</span>
              </button>
            </div>

            {/* The verse content, fading briefly during rotation */}
            <div className={`space-y-3 max-w-2xl mx-auto transition-opacity duration-150 ${isRotating ? "opacity-30" : "opacity-100"}`}>
              <p className="font-gurmukhi text-xl sm:text-2xl leading-relaxed text-[var(--text)] font-semibold">
                {currentVerse.gurmukhi}
              </p>
              <p className="text-xs italic text-[var(--text-muted)]">
                {currentVerse.transliteration}
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {currentVerse.translation}
              </p>
              {currentVerse.writer && (
                <p className="text-[11px] font-medium text-[var(--text-faint)] pt-1">
                  — {currentVerse.writer}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Link
                href={`/ang/${currentVerse.ang}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                <span>Read in Context (Ang {currentVerse.ang})</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Upcoming Gurpurabs — Nanakshahi holy-day calendar                */}
          {/* -------------------------------------------------------------- */}
          <GurpurabCalendar />

          {/* -------------------------------------------------------------- */}
          {/* Learn Gurmukhi CTA                                              */}
          {/* -------------------------------------------------------------- */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <GraduationCap size={24} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <div>
                  <h3 className="text-base font-bold text-[var(--text)]">Learn Gurmukhi</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Practise the 35 primary akhars with a quick multiple-choice drill, then read the
                    scripture directly.
                  </p>
                </div>
              </div>
              <Link
                href="/learn"
                className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                <span>Start Practising</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Canonical Raags & Major Sections — link card grid                 */}
          {/* -------------------------------------------------------------- */}
          <section className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-[var(--text)]">{TOTAL_CANONICAL_SECTIONS} Canonical Raags &amp; Major Sections</h3>
              <p className="text-xs text-[var(--text-muted)]">Jump directly to the starting Ang of any major section.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {RAAG_SECTIONS.map((r) => (
                <Link
                  key={r.name + r.ang}
                  href={`/ang/${r.ang}`}
                  className="group flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] active:scale-[0.97]"
                >
                  <div>
                    <span className="text-[10px] font-bold text-[var(--accent)]">Ang {r.ang}</span>
                    <h4 className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition">
                      {r.name}
                    </h4>
                  </div>
                  <p className="mt-2 font-gurmukhi text-xs text-[var(--text-muted)] truncate">
                    {r.gurmukhi}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </main>

        {/* Footer — Fateh, app name, source link, author credit */}
        <footer className="mt-16 border-t border-[var(--border-subtle)] bg-[var(--surface)]/80 backdrop-blur-md px-5 py-10 text-center">
          <KhandaIcon size={34} className="text-[var(--accent)]" />
          <p dir="auto" lang="pa" className="font-gurmukhi mt-4 text-lg font-semibold leading-relaxed text-[var(--text)]">
            ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ॥ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਹਿ ॥
          </p>
          <p className="mt-1 text-xs italic text-[var(--text-muted)]">
            Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh
          </p>
          <div className="mx-auto mt-5 h-px w-24 bg-[var(--border)]" aria-hidden="true" />
          <p className="mt-5 text-xs text-[var(--text-muted)]">
            Sri Guru Granth Sahib Ji — Ang Reader
          </p>
          <a
            href="https://github.com/mithun-srinivasan/srigurugranthsahib"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--accent)]"
          >
            <Github size={13} />
            <span>Open source on GitHub</span>
          </a>
          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            Made with love and faith by Mithun <span aria-hidden="true">ੴ</span>
          </p>
        </footer>
      </div>
    </div>
  );
}







